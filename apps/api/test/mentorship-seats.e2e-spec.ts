import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { UserRole } from "@mentor/types";
import { ConfigRegistryService } from "../src/common/config/config-registry.service";

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
    });
    expect(res.status).toBe(201);
    token[label] = res.body.accessToken;
    userId[label] = res.body.user.id;
  };

  /** Grant a role in the DB, then re-login so the JWT actually carries it. */
  const grantRoleAndRelogin = async (label: string, role: string): Promise<void> => {
    await svc(async (c) => {
      await c.query("update users set roles = array_append(roles,$1) where id=$2", [
        role,
        userId[label],
      ]);
    });
    const login = await http()
      .post("/v1/auth/login")
      .send({ email: `w8s-${label}-${stamp}@test.local`, password: "Sifre1234" });
    expect(login.status).toBe(200);
    token[label] = login.body.accessToken;
  };

  const subscriptionOf = async (who: string) =>
    (await http().get("/v1/subscription").set(auth(who))).body;

  beforeAll(async () => {
    process.env.DATABASE_URL =
      process.env.TEST_DATABASE_URL ?? "postgres://mentor:mentor@localhost:5433/mentor_test";
    process.env.JWT_ACCESS_SECRET ??= "test-secret-test-secret-test-secret!!";

    const { AppModule } = await import("../src/app.module");
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    app.setGlobalPrefix("v1");
    app.use(cookieParser());
    await app.init();
    pool = new Pool({ connectionString: process.env.DATABASE_URL });

    stamp = Date.now();
    for (const label of ["coach", "seated", "spare", "admin"]) await signup(label);
    await grantRoleAndRelogin("coach", UserRole.COACH);
    await grantRoleAndRelogin("admin", UserRole.SUPER_ADMIN);

    const config = app.get(ConfigRegistryService);
    await config.set(userId.admin!, "mentorship.enabled", true);
    await config.set(userId.admin!, "mentorship.seats.sponsorship_enabled", true);
    // One free seat: enough to prove the boundary in both directions.
    await config.set(userId.admin!, "mentorship.coach.free_seats", 1);
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

  it("hands the seated student Premium the moment the link is accepted", async () => {
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

  it("follows the next student without sponsoring them", async () => {
    const accept = await http()
      .post("/v1/mentorship/invitations/accept")
      .set(auth("spare"))
      .send({ code });
    expect(accept.status).toBe(200);

    // free_seats is 1 and it is taken: this one is coached, not paid for.
    const view = await subscriptionOf("spare");
    expect(view.entitlement.isPremium).toBe(false);
    expect(view.subscription).toBeNull();

    // Still on the roster, though — the seat decides Premium, not who may be followed.
    const roster = await http().get("/v1/mentorship/students").set(auth("coach"));
    expect(roster.body.total).toBe(2);
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
});
