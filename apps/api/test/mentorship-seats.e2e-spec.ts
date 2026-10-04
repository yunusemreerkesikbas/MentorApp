import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { EventEmitter2 } from "@nestjs/event-emitter";
import cookieParser from "cookie-parser";
import { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { UserRole } from "@mentor/types";
import { ConfigRegistryService } from "../src/common/config/config-registry.service";
import { IdentityEventTopic } from "../src/modules/identity/domain/identity.events";

const CRON_SECRET = `seats-cron-secret-for-e2e-${Date.now()}-only`;

/**
 * W8 sponsored seats e2e — a coach's seat carrying the student's Premium.
 *
 * Its own file rather than a block inside `mentorship.e2e-spec.ts` for two reasons: the accept
 * endpoint is throttled to 5/min per user and that suite already spends all five, and turning
 * sponsorship on would change what every accept in it does. Here the whole chain runs for real —
 * event → listener → subscription row → entitlement — which is the part no unit test can prove.
 */
describe("mentorship seats (e2e)", () => {
  let app: INestApplication;
  let pool: Pool;

  const token: Record<string, string> = {};
  const userId: Record<string, string> = {};
  let stamp = 0;

  const auth = (who: string) => ({ Authorization: `Bearer ${token[who]}` });
  const http = () => request(app.getHttpServer());

  const svc = async (fn: (c: import("pg").PoolClient) => Promise<void>) => {
    const c = await pool.connect();
    try {
      await c.query("begin");
      await c.query("select set_config('app.role','SERVICE',true)");
      await fn(c);
      await c.query("commit");
    } catch (err) {
      // Without this the client goes back to the pool mid-transaction and the next test picks it
      // up in a failed state — a failure that surfaces somewhere else entirely.
      await c.query("rollback").catch(() => undefined);
      throw err;
    } finally {
      c.release();
    }
  };

  const signup = async (label: string): Promise<void> => {
    const res = await http().post("/v1/auth/signup").send({
      email: `w8s-${label}-${stamp}@test.local`,
      password: "Sifre1234",
      displayName: `W8S ${label}`,
      kvkkAccepted: true,
      termsAccepted: true,
      ageEligibilityConfirmed: true,
    });
    expect(res.status).toBe(201);
    token[label] = res.body.accessToken;
    userId[label] = res.body.user.id;
  };

  /** Grant a role in the DB, then re-login so the JWT actually carries it. */
  /**
   * Grant a role in the DB, then re-login so the JWT actually carries it.
   *
   * COACH also gets what self-service registration would have written (APP-089): a verified email
   * and an ACTIVE registry row, without which the invite code is refused.
   */
  const grantRoleAndRelogin = async (label: string, role: string): Promise<void> => {
    await svc(async (c) => {
      await c.query("update users set roles = array_append(roles,$1) where id=$2", [
        role,
        userId[label],
      ]);
      if (role === UserRole.COACH) {
        await c.query("update users set email_verified_at = now(), phone_number = '+905' || lpad((abs(hashtext(id::text)::bigint) % 1000000000)::text, 9, '0'), phone_verified_at = now() where id = $1", [userId[label]]);
        await c.query(
          "insert into mentorship_coach_applications (user_id, status, headline, bio) values ($1, $2, $3, $4) on conflict (user_id) do nothing",
          [userId[label], "ACTIVE", "Test kocu", "Test koc profili."],
        );
      }
    });
    const login = await http()
      .post("/v1/auth/login")
      .send({ email: `w8s-${label}-${stamp}@test.local`, password: "Sifre1234" });
    expect(login.status).toBe(200);
    token[label] = login.body.accessToken;
  };

  const subscriptionOf = async (who: string) =>
    (await http().get("/v1/subscription").set(auth(who))).body;

  /** Give a user an open subscription of their own, retiring whatever they held (one open row). */
  const subscribe = (who: string, planId: string) =>
    svc(async (c) => {
      await c.query(
        "update subscriptions set status = 'EXPIRED' where user_id = $1 and status <> 'EXPIRED'",
        [userId[who]],
      );
      await c.query(
        `insert into subscriptions (user_id, plan_id, status, provider, current_period_start, current_period_end)
         values ($1, $2, 'ACTIVE', 'FAKE', now() - interval '1 day', now() + interval '30 days')`,
        [userId[who], planId],
      );
    });

  /** End a user's open subscription outright, the way a provider cancel webhook would. */
  const expireOpen = (who: string) =>
    svc(async (c) => {
      await c.query(
        "update subscriptions set status = 'EXPIRED' where user_id = $1 and status <> 'EXPIRED'",
        [userId[who]],
      );
    });

  const overviewOf = async () =>
    (await http().get("/v1/mentorship/overview").set(auth("coach"))).body;
  const reportStatus = async (who: string) =>
    (await http().get(`/v1/mentorship/students/${userId[who]}`).set(auth("coach"))).status;

  beforeAll(async () => {
    process.env.DATABASE_URL =
      process.env.TEST_DATABASE_URL ?? "postgres://mentor:mentor@localhost:5433/mentor_test";
    process.env.JWT_ACCESS_SECRET ??= "test-secret-test-secret-test-secret!!";
    // The expiry sweeper is how a lapsed plan reaches the seats without anyone opening a page.
    process.env.CRON_SECRET = CRON_SECRET;

    const { AppModule } = await import("../src/app.module");
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    app.setGlobalPrefix("v1");
    app.use(cookieParser());
    await app.init();
    pool = new Pool({ connectionString: process.env.DATABASE_URL });

    stamp = Date.now();
    for (const label of ["coach", "seated", "spare", "payer", "admin"]) await signup(label);
    await svc(async (c) => {
      await c.query("update users set phone_number = '+905' || lpad((abs(hashtext(id::text)::bigint) % 1000000000)::text, 9, '0'), phone_verified_at = now() where id = any($1::uuid[])", [[userId.spare, userId.payer]]);
    });
    await grantRoleAndRelogin("coach", UserRole.COACH);
    await grantRoleAndRelogin("admin", UserRole.SUPER_ADMIN);

    const config = app.get(ConfigRegistryService);
    await config.set(userId.admin!, "mentorship.enabled", true);
    await config.set(userId.admin!, "mentorship.seats.sponsorship_enabled", true);
    // One free seat: enough to prove the boundary in both directions.
    await config.set(userId.admin!, "mentorship.coach.free_seats", 1);
    await config.set(userId.admin!, "mentorship.followups.enabled", true);
  }, 120_000);

  afterAll(async () => {
    if (pool) {
      await svc(async (c) => {
        await c.query("delete from config_overrides where key like 'mentorship.%'");
      });
    }
    await app?.close();
    await pool?.end();
  });

  let code = "";
  /** Platform-wide subscription counters as they stood before this suite handed out any seat. */
  let baseline = { payingSubscriptions: 0, active: 0 };

  it("links an unverified student and grants Premium immediately after phone verification", async () => {
    const before = await http().get("/v1/admin/metrics").set(auth("admin"));
    baseline = {
      payingSubscriptions: before.body.subscriptions.payingSubscriptions,
      active: before.body.subscriptions.byStatus.active,
    };

    code = (await http().post("/v1/mentorship/invite-code").set(auth("coach"))).body.code;

    expect(await subscriptionOf("seated")).toMatchObject({
      entitlement: { isPremium: false, reason: "NONE" },
    });

    const accept = await http()
      .post("/v1/mentorship/invitations/accept")
      .set(auth("seated"))
      .send({ code });
    expect(accept.status).toBe(200);
    expect(accept.body).toMatchObject({ status: "ACTIVE", sponsoredPremiumPending: true });
    expect((await subscriptionOf("seated")).entitlement.isPremium).toBe(false);

    await svc(async (c) => {
      await c.query("update users set phone_number = '+905' || lpad((abs(hashtext(id::text)::bigint) % 1000000000)::text, 9, '0'), phone_verified_at = now() where id = $1", [userId.seated]);
    });
    // Identity emits this only after verified state commits. No coach overview repairs this test.
    app.get(EventEmitter2).emit(IdentityEventTopic.PHONE_VERIFIED, { userId: userId.seated });

    // The listener runs off a fire-and-forget emit, so the row can land a beat after the response.
    let view = await subscriptionOf("seated");
    for (let attempt = 0; attempt < 20 && !view.entitlement.isPremium; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      view = await subscriptionOf("seated");
    }

    // The whole architecture in one assertion: entitlement said yes without `computeEntitlement`
    // learning a single thing about coaching.
    expect(view.entitlement).toMatchObject({ isPremium: true, reason: "ACTIVE" });
    // Endless while the seat holds — no monthly extension cron exists, and none is needed.
    expect(view.subscription).toMatchObject({
      planId: "coach-seat",
      sponsored: true,
      currentPeriodEnd: null,
    });
    expect((await http().get("/v1/mentorship/my-coach").set(auth("seated"))).body.sponsoredPremiumPending).toBe(false);
  });

  it("keeps the seat plans out of the catalog anyone can buy", async () => {
    const plans = (await http().get("/v1/plans").set(auth("seated"))).body as { id: string }[];
    const ids = plans.map((plan) => plan.id);
    expect(ids.length).toBeGreaterThan(0);
    // `coach-seat` is what a sponsored row points at: priced 0, never a product.
    expect(ids).not.toContain("coach-seat");
    // The Pro plans are real products but stay hidden while `mentorship.seats.billing_enabled`
    // is off — listing a plan the provider cannot charge for would price a promise.
    expect(ids).not.toContain("coach-pro-10");
  });

  it("refuses the next student once the free seat is taken", async () => {
    const accept = await http()
      .post("/v1/mentorship/invitations/accept")
      .set(auth("spare"))
      .send({ code });
    expect(accept.status).toBe(409);
    expect(accept.body.code).toBe("MENTORSHIP_SEATS_FULL");

    const view = await subscriptionOf("spare");
    expect(view.entitlement.isPremium).toBe(false);
    expect(view.subscription).toBeNull();

    const roster = await http().get("/v1/mentorship/students").set(auth("coach"));
    expect(roster.body.total).toBe(1);
  });

  it("does not count a giveaway as a conversion", async () => {
    const metrics = await http().get("/v1/admin/metrics").set(auth("admin"));
    expect(metrics.status).toBe(200);
    // A DELTA, not an absolute: these counters are platform-wide and this suite shares its
    // database with every other one. What has to hold is that handing out a seat moved neither —
    // the seat writes no ledger row, and `countByStatus` filters sponsored rows out of the
    // funnel's denominator.
    expect(metrics.body.subscriptions.payingSubscriptions).toBe(baseline.payingSubscriptions);
    expect(metrics.body.subscriptions.byStatus.active).toBe(baseline.active);
  });

  it("ends the sponsorship with the link and leaves nothing blocking the student", async () => {
    expect(
      (await http().delete(`/v1/mentorship/students/${userId.seated}`).set(auth("coach"))).status,
    ).toBe(204);

    // Poll on the row closing, not on `isPremium`: revoke writes EXPIRED and a past
    // `currentPeriodEnd` in one update, and entitlement can read false off either half. Waiting
    // for the stronger condition is what makes this deterministic under a full-suite run.
    let view = await subscriptionOf("seated");
    for (let attempt = 0; attempt < 40 && view.subscription !== null; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      view = await subscriptionOf("seated");
    }
    expect(view.entitlement.isPremium).toBe(false);
    // Expired outright rather than left to the sweeper: `listMaybeRanOut` waits out the dunning
    // grace, and three days of a dead-but-open row would keep `findOpenForUser` blocking this
    // student from paying for themselves at the one moment they are most likely to want to.
    expect(view.subscription).toBeNull();
  });

  /**
   * A seat is the coach's room to follow a student; sponsorship is only what it adds. With the
   * flag off the free seat still links (the coach surface does not wait for SMS OTP), and no
   * Premium row appears behind it.
   */
  it("still links on a free seat while sponsorship is off, with no Premium behind it", async () => {
    await app
      .get(ConfigRegistryService)
      .set(userId.admin!, "mentorship.seats.sponsorship_enabled", false);

    const accept = await http()
      .post("/v1/mentorship/invitations/accept")
      .set(auth("spare"))
      .send({ code });
    expect(accept.status).toBe(200);

    const overview = await http().get("/v1/mentorship/overview").set(auth("coach"));
    expect(overview.body).toMatchObject({
      activeStudents: 1,
      seatAllowance: 1,
      sponsorshipEnabled: false,
    });

    // The grant runs off a fire-and-forget emit: give it the window the first test waits, then
    // prove nothing arrived.
    await new Promise((resolve) => setTimeout(resolve, 500));
    const view = await subscriptionOf("spare");
    expect(view.entitlement.isPremium).toBe(false);
    expect(view.subscription).toBeNull();
  });

  // Phase B: the seat lives on the link. `spare` holds the one free seat from here on.
  let followupId = "";

  /** One payer per student: somebody already paying for their Premium takes no seat. */
  it("links a student who pays for their own Premium even though every seat is taken", async () => {
    await subscribe("payer", "premium-monthly");
    const accept = await http()
      .post("/v1/mentorship/invitations/accept")
      .set(auth("payer"))
      .send({ code });
    expect(accept.status).toBe(200);
    expect(await overviewOf()).toMatchObject({ activeStudents: 2, usedSeats: 1, waitingStudents: 0 });
    expect(await reportStatus("payer")).toBe(200);

    // A shared decision the student will have to answer after the freeze below.
    const created = await http()
      .post(`/v1/mentorship/students/${userId.payer}/followups`)
      .set(auth("coach"))
      .send({
        operationId: randomUUID(),
        title: "Deneme planı",
        privateNote: "Koçun notu",
        sharedDecision: "Hafta sonu bir deneme çöz",
        followUpDate: null,
      });
    expect(created.status).toBe(201);
    followupId = created.body.id;
  });

  it("freezes that student when their own Premium ends and no seat is free", async () => {
    await expireOpen("payer");
    // Opening the coach's home is the reseat of last resort (no payments event came from SQL).
    expect(await overviewOf()).toMatchObject({ activeStudents: 2, usedSeats: 1, waitingStudents: 1 });

    const report = await http().get(`/v1/mentorship/students/${userId.payer}`).set(auth("coach"));
    expect(report.status).toBe(409);
    expect(report.body.code).toBe("MENTORSHIP_SEAT_WAITING");

    const roster = await http().get("/v1/mentorship/students").set(auth("coach"));
    const row = roster.body.items.find(
      (item: { studentId: string }) => item.studentId === userId.payer,
    );
    expect(row).toMatchObject({ seat: "NONE", metrics: null, needsAttention: false });

    const mine = await http().get("/v1/mentorship/my-coach").set(auth("payer"));
    expect(mine.body.seatWaiting).toBe(true);
  });

  it("still lets the student answer their coach on a frozen link", async () => {
    const answer = await http()
      .put(`/v1/mentorship/my-coach/followups/${followupId}/response`)
      .set(auth("payer"))
      .send({ version: 1, response: "ACCEPTED" });
    expect(answer.status).toBe(200);
  });

  it("brings the student back when the coach buys seats, and freezes them when the plan runs out", async () => {
    await subscribe("coach", "coach-plus-5");
    expect(await overviewOf()).toMatchObject({ paidSeats: 5, usedSeats: 2, waitingStudents: 0 });
    expect(await reportStatus("payer")).toBe(200);

    // The plan runs out. The sweeper retires it (past the 3-day dunning window it waits out) and
    // its EXPIRED event reseats: no page visit.
    await svc(async (c) => {
      await c.query(
        "update subscriptions set current_period_end = now() - interval '10 days' where user_id = $1 and status = 'ACTIVE'",
        [userId.coach],
      );
    });
    const sweep = await http()
      .post("/v1/internal/cron/expire-subscriptions")
      .set("x-cron-secret", CRON_SECRET);
    expect(sweep.status).toBe(201);

    let status = await reportStatus("payer");
    for (let attempt = 0; attempt < 40 && status !== 409; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      status = await reportStatus("payer");
    }
    expect(status).toBe(409);
    // The free seat stays where it was: a lapse only takes back what the plan paid for.
    expect(await reportStatus("spare")).toBe(200);
  });

  it("lets the student leave a frozen link", async () => {
    expect((await http().delete("/v1/mentorship/my-coach").set(auth("payer"))).status).toBe(204);
    expect(await overviewOf()).toMatchObject({ activeStudents: 1, waitingStudents: 0 });
  });
});
