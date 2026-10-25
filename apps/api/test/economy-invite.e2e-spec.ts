import { disableAuthRateLimits } from "./app-harness";
import { JobRunnerService } from "../src/modules/notifications/application/job-runner.service";
import { SubscriptionsService } from "../src/modules/payments/application/subscriptions.service";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import * as express from "express";
import { Pool } from "pg";
import request from "./browser-request";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { UserRole } from "@mentor/types";
import { signFakeWebhook } from "../src/modules/payments/infrastructure/adapters/fake-payments.adapter";
import { TEST_PHONE_FINGERPRINT_SECRET } from "./phone-test-harness";

const SECRET = "test-payments-webhook-secret"; // matches vitest env
const RUN = Date.now();

/**
 * W6 economy slice 2a (e2e): invite → conversion → coin, against a real Postgres (RLS active).
 * Inviter (Ayşe) gets a code; invited (Burak) redeems; Burak's subscription activates (fake webhook)
 * → the inviter is rewarded coin exactly once.
 */
describe("economy invite (e2e)", () => {
  let app: INestApplication;
  let pool: Pool;
  let adminToken = "";
  let ayseToken = "";
  let burakToken = "";
  let burakId = "";
  let adminId = "";

  const signup = async (label: string) => {
    const email = `inv-${label}-${RUN}@test.local`;
    const res = await request(app.getHttpServer())
      .post("/v1/auth/signup")
      .send({ email, password: "Sifre1234", displayName: `Inv ${label}`, kvkkAccepted: true, termsAccepted: true, ageEligibilityConfirmed: true });
    return { email, ...(res.body as { accessToken: string; user: { id: string } }) };
  };

  /** Only the carded-trial buyer needs a verified phone; invite/earned-right users do not. */
  async function verifyTrialPhone(userId: string): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query("select set_config('app.role','SERVICE',true)");
      await client.query(
        "update users set phone_number = '+905' || lpad((abs(hashtext(id::text)::bigint) % 1000000000)::text, 9, '0'), phone_verified_at = now() where id = $1",
        [userId],
      );
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }

  beforeAll(async () => {
    process.env.DATABASE_URL =
      process.env.TEST_DATABASE_URL ?? "postgres://mentor:mentor@localhost:5433/mentor_test";
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    process.env.PHONE_FINGERPRINT_SECRET = TEST_PHONE_FINGERPRINT_SECRET;

    const { AppModule } = await import("../src/app.module");
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    disableAuthRateLimits(moduleRef);
    app = moduleRef.createNestApplication({ logger: false });
    app.setGlobalPrefix("v1");
    app.use(cookieParser());
    app.use(
      express.json({
        verify: (req: { rawBody?: Buffer }, _res, buf: Buffer) => {
          req.rawBody = buf;
        },
      }),
    );
    await app.init();

    const admin = await signup("admin");
    const ayse = await signup("ayse");
    const burak = await signup("burak");
    ayseToken = ayse.accessToken;
    burakToken = burak.accessToken;
    burakId = burak.user.id;
    adminId = admin.user.id;
    await verifyTrialPhone(burakId);

    // Promote admin → ADMIN (SERVICE-context SQL) then re-login for the role in the JWT.
    const c = await pool.connect();
    try {
      await c.query("begin");
      await c.query("select set_config('app.role','SERVICE',true)");
      await c.query("update users set roles = array_append(roles,$1) where id=$2", [UserRole.ADMIN, admin.user.id]);
      await c.query("commit");
    } finally {
      c.release();
    }
    const login = await request(app.getHttpServer())
      .post("/v1/auth/login")
      .send({ email: admin.email, password: "Sifre1234" });
    adminToken = login.body.accessToken;

    // Enable the economy feature (goes through the config service → cache invalidated).
    await request(app.getHttpServer())
      .patch("/v1/admin/config/economy.enabled")
      .set({ Authorization: `Bearer ${adminToken}` })
      .send({ value: true });
  }, 90_000);

  afterAll(async () => {
    await app?.close();
    await pool?.end();
  });

  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  let code = "";

  it("inviter gets a stable invite code", async () => {
    const res = await request(app.getHttpServer()).get("/v1/economy/invite").set(auth(ayseToken));
    expect(res.status).toBe(200);
    expect(res.body.code).toMatch(/^PUHU-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/);
    code = res.body.code;
  });

  it("rejects self-redeem", async () => {
    const res = await request(app.getHttpServer())
      .post("/v1/economy/invite/redeem")
      .set(auth(ayseToken))
      .send({ code });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("INVITE_SELF");
  });

  it("rejects an unknown code", async () => {
    const res = await request(app.getHttpServer())
      .post("/v1/economy/invite/redeem")
      .set(auth(burakToken))
      .send({ code: "PUHU-DEADBEEF" });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("INVITE_CODE_INVALID");
  });

  it("invited redeems (PENDING) and can't redeem twice", async () => {
    // Typed by hand: lower case with stray spaces still resolves (the pipe hands the service the normalized code).
    const ok = await request(app.getHttpServer())
      .post("/v1/economy/invite/redeem")
      .set(auth(burakToken))
      .send({ code: `  ${code.toLowerCase()} ` });
    expect(ok.status).toBe(201);
    expect(ok.body.status).toBe("PENDING");

    const again = await request(app.getHttpServer())
      .post("/v1/economy/invite/redeem")
      .set(auth(burakToken))
      .send({ code });
    expect(again.status).toBe(409);
    expect(again.body.code).toBe("INVITE_ALREADY_REDEEMED");
  });

  it("rewards the inviter once when the invited user converts", async () => {
    // Burak subscribes (trial) then a payment_succeeded webhook activates it → SUBSCRIPTION_ACTIVATED.
    const checkout = await request(app.getHttpServer())
      .post("/v1/subscription/checkout")
      .set(auth(burakToken))
      .send({ planId: "premium-monthly", useTrial: true });
    expect(checkout.status).toBe(200);
    const providerRef = new URL(checkout.body.checkoutUrl).searchParams.get("ref")!;

    const fire = async (id: string) => {
      const { body, headers } = signFakeWebhook(SECRET, {
        eventId: `evt_${id}_${RUN}`,
        type: "payment_succeeded",
        providerRef,
        amountMinor: 24900,
      });
      return request(app.getHttpServer()).post("/v1/webhooks/payments").set(headers).send(JSON.parse(body));
    };

    const trialBalance = await request(app.getHttpServer()).get("/v1/economy/balance").set(auth(ayseToken));
    expect(trialBalance.body.coinConfirmed).toBe(0);
    await Promise.all([fire("a"), fire("a")]);
    await app.get(JobRunnerService).processBatch(100);

    const bal1 = await request(app.getHttpServer()).get("/v1/economy/balance").set(auth(ayseToken));
    expect(bal1.body.coinConfirmed).toBe(20);

    // A second activation must NOT double-reward (redemption already CONVERTED + grant idempotent).
    await fire("b");
    await app.get(JobRunnerService).processBatch(100);
    const bal2 = await request(app.getHttpServer()).get("/v1/economy/balance").set(auth(ayseToken));
    expect(bal2.body.coinConfirmed).toBe(20);
  }, 30_000);

  it("a renewal refund keeps the initial payment reward", async () => {
    await app.get(SubscriptionsService).refundLastCharge(burakId, 100, "e2e renewal refund", adminId);
    await app.get(JobRunnerService).processBatch(100);
    const balance = await request(app.getHttpServer()).get("/v1/economy/balance").set(auth(ayseToken));
    expect(balance.body.coinConfirmed).toBe(20);
  });

  it("refund of the source payment reverses its reward even while economy is disabled", async () => {
    const inviter = await signup("refund-inviter");
    const invited = await signup("refund-invited");
    await verifyTrialPhone(invited.user.id);
    const invite = await request(app.getHttpServer()).get("/v1/economy/invite").set(auth(inviter.accessToken));
    await request(app.getHttpServer()).post("/v1/economy/invite/redeem")
      .set(auth(invited.accessToken)).send({ code: invite.body.code }).expect(201);
    const checkout = await request(app.getHttpServer()).post("/v1/subscription/checkout")
      .set(auth(invited.accessToken)).send({ planId: "premium-monthly", useTrial: true }).expect(200);
    const providerRef = new URL(checkout.body.checkoutUrl).searchParams.get("ref")!;
    const { body, headers } = signFakeWebhook(SECRET, {
      eventId: `evt_refund_source_${RUN}`, type: "payment_succeeded", providerRef, amountMinor: 24900,
    });
    await request(app.getHttpServer()).post("/v1/webhooks/payments").set(headers).send(JSON.parse(body)).expect(200);
    await app.get(JobRunnerService).processBatch(100);
    const before = await request(app.getHttpServer()).get("/v1/economy/balance").set(auth(inviter.accessToken));
    expect(before.body.coinConfirmed).toBe(20);
    await request(app.getHttpServer()).patch("/v1/admin/config/economy.enabled")
      .set(auth(adminToken)).send({ value: false }).expect(200);
    try {
      await app.get(SubscriptionsService).refundLastCharge(invited.user.id, 100, "e2e source refund", adminId);
      await app.get(JobRunnerService).processBatch(100);
    } finally {
      await request(app.getHttpServer()).patch("/v1/admin/config/economy.enabled")
        .set(auth(adminToken)).send({ value: true }).expect(200);
    }
    const after = await request(app.getHttpServer()).get("/v1/economy/balance").set(auth(inviter.accessToken));
    expect(after.body.coinConfirmed).toBe(0);
  });

  describe("redeem rules: trial, paid, window, coaches", () => {
    /** SERVICE-context write to `users` (identity owns the table; tests bypass the API on purpose). */
    const updateUser = async (sql: string, params: unknown[]): Promise<void> => {
      const client = await pool.connect();
      try {
        await client.query("begin");
        await client.query("select set_config('app.role','SERVICE',true)");
        await client.query(sql, params);
        await client.query("commit");
      } catch (error) {
        await client.query("rollback");
        throw error;
      } finally {
        client.release();
      }
    };
    const makeCoach = (userId: string) =>
      updateUser("update users set roles = array_append(roles,$1) where id=$2", [UserRole.COACH, userId]);

    /** Trial checkout with the fake provider: the subscription is TRIALING at once, no money moved. */
    const startTrial = async (token: string): Promise<string> => {
      const checkout = await request(app.getHttpServer()).post("/v1/subscription/checkout")
        .set(auth(token)).send({ planId: "premium-monthly", useTrial: true }).expect(200);
      return new URL(checkout.body.checkoutUrl).searchParams.get("ref")!;
    };
    const pay = async (providerRef: string, tag: string): Promise<void> => {
      const { body, headers } = signFakeWebhook(SECRET, {
        eventId: `evt_${tag}_${RUN}`, type: "payment_succeeded", providerRef, amountMinor: 24900,
      });
      await request(app.getHttpServer()).post("/v1/webhooks/payments").set(headers).send(JSON.parse(body)).expect(200);
      await app.get(JobRunnerService).processBatch(100);
    };
    const inviteCodeOf = async (token: string): Promise<string> =>
      (await request(app.getHttpServer()).get("/v1/economy/invite").set(auth(token)).expect(200)).body.code;
    const redeem = (token: string, body: { code: string }) =>
      request(app.getHttpServer()).post("/v1/economy/invite/redeem").set(auth(token)).send(body);
    const coinOf = async (token: string): Promise<number> =>
      (await request(app.getHttpServer()).get("/v1/economy/balance").set(auth(token)).expect(200)).body.coinConfirmed;

    it("a user in a trial can still redeem (lower case), and the first real payment rewards the inviter", async () => {
      const inviter = await signup("trial-inviter");
      const invited = await signup("trial-invited");
      await verifyTrialPhone(invited.user.id);
      const code = await inviteCodeOf(inviter.accessToken);

      const providerRef = await startTrial(invited.accessToken);
      const view = await request(app.getHttpServer()).get("/v1/subscription").set(auth(invited.accessToken));
      expect(view.body.subscription.status).toBe("TRIALING");

      const res = await redeem(invited.accessToken, { code: code.toLowerCase() });
      expect(res.status).toBe(201);
      expect(res.body.status).toBe("PENDING");
      expect(await coinOf(inviter.accessToken)).toBe(0); // the trial itself pays nothing

      await pay(providerRef, "trial-redeem");
      expect(await coinOf(inviter.accessToken)).toBe(20);
    }, 30_000);

    it("a user who already paid gets INVITE_ALREADY_PAID", async () => {
      const inviter = await signup("paid-inviter");
      const payer = await signup("paid-user");
      await verifyTrialPhone(payer.user.id);
      const code = await inviteCodeOf(inviter.accessToken);

      await pay(await startTrial(payer.accessToken), "paid-user");
      const res = await redeem(payer.accessToken, { code });
      expect(res.status).toBe(409);
      expect(res.body.code).toBe("INVITE_ALREADY_PAID");
    }, 30_000);

    it("closes the redeem window after the configured days and says how many", async () => {
      const inviter = await signup("window-inviter");
      const late = await signup("window-late");
      const code = await inviteCodeOf(inviter.accessToken);
      await updateUser("update users set created_at = now() - interval '8 days' where id = $1", [late.user.id]);

      const res = await redeem(late.accessToken, { code });
      expect(res.status).toBe(409);
      expect(res.body.code).toBe("INVITE_WINDOW_CLOSED");
      expect(res.body.details).toEqual({ days: 7 });
      expect(res.body.message).toMatch(/\b7\b/);
      expect(res.body.message).not.toContain("{days}");
    });

    it("keeps coaches out: no code, no redeem, and a coach-owned code is invalid", async () => {
      const coach = await signup("coach");
      const student = await signup("coach-student");
      const lateCoach = await signup("late-coach");
      const lateCoachCode = await inviteCodeOf(lateCoach.accessToken);
      const studentCode = await inviteCodeOf(student.accessToken);
      await makeCoach(coach.user.id);
      await makeCoach(lateCoach.user.id);

      const mint = await request(app.getHttpServer()).get("/v1/economy/invite").set(auth(coach.accessToken));
      expect(mint.status).toBe(403);
      expect(mint.body.code).toBe("INVITE_COACH_NOT_ALLOWED");

      const asCoach = await redeem(coach.accessToken, { code: studentCode });
      expect(asCoach.status).toBe(403);
      expect(asCoach.body.code).toBe("INVITE_COACH_NOT_ALLOWED");

      const fresh = await signup("coach-code-redeemer");
      const ownedByCoach = await redeem(fresh.accessToken, { code: lateCoachCode });
      expect(ownedByCoach.status).toBe(404);
      expect(ownedByCoach.body.code).toBe("INVITE_CODE_INVALID");
    });

    it("pays no Coin when the inviter became a coach before the friend's first payment", async () => {
      const inviter = await signup("skip-inviter");
      const invited = await signup("skip-invited");
      await verifyTrialPhone(invited.user.id);
      const code = await inviteCodeOf(inviter.accessToken);
      await redeem(invited.accessToken, { code }).expect(201);
      await makeCoach(inviter.user.id);

      await pay(await startTrial(invited.accessToken), "skip-coach");
      expect(await coinOf(inviter.accessToken)).toBe(0);
      const client = await pool.connect();
      try {
        await client.query("begin");
        await client.query("select set_config('app.role','SERVICE',true)");
        const row = await client.query(
          "select status, reward_outcome from invite_redemptions where invited_user_id = $1", [invited.user.id]);
        await client.query("commit");
        expect(row.rows[0]).toEqual({ status: "CONVERTED", reward_outcome: "COACH_SKIPPED" });
      } finally {
        client.release();
      }
    }, 30_000);
  });

  describe("redeem side effects: study buddy, mutual follow, inviter notification", () => {
    /** SERVICE-context read (the tables belong to identity / notifications; tests bypass the API on purpose). */
    const serviceRows = async (sql: string, params: unknown[]): Promise<Array<Record<string, unknown>>> => {
      const client = await pool.connect();
      try {
        await client.query("begin");
        await client.query("select set_config('app.role','SERVICE',true)");
        const res = await client.query(sql, params);
        await client.query("commit");
        return res.rows;
      } catch (error) {
        await client.query("rollback");
        throw error;
      } finally {
        client.release();
      }
    };
    const buddyRows = (a: string, b: string) =>
      serviceRows(
        "select requester_id, addressee_id, status from buddy_pairs where requester_id in ($1,$2) or addressee_id in ($1,$2)",
        [a, b],
      );
    const followRows = (a: string, b: string) =>
      serviceRows(
        "select follower_id, followee_id from user_follows where follower_id in ($1,$2) and followee_id in ($1,$2)",
        [a, b],
      );
    /** Templates the invite flow can put in the inviter's inbox (plus the follow one, which must stay out). */
    const inviteInbox = (userId: string) =>
      serviceRows(
        "select data->>'templateKey' as template, category, link_url, dedupe_key from user_notifications "
          + "where user_id = $1 and data->>'templateKey' in ('inviteJoined','buddyRequestedViaInvite','newFollower','buddyRequested') "
          + "order by created_at",
        [userId],
      );
    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    /** Listeners run after the HTTP response: wait for the first row, then give any duplicate time to show up. */
    const settledInbox = async (userId: string) => {
      for (let i = 0; i < 40 && (await inviteInbox(userId)).length === 0; i++) await sleep(100);
      await sleep(400);
      return inviteInbox(userId);
    };
    const redeem = (token: string, body: { code: string }) =>
      request(app.getHttpServer()).post("/v1/economy/invite/redeem").set(auth(token)).send(body);
    const inviteCodeOf = async (token: string): Promise<string> =>
      (await request(app.getHttpServer()).get("/v1/economy/invite").set(auth(token)).expect(200)).body.code;

    it("two simultaneous redeems by one user: one 201, one 409, one buddy request, one inviter notification", async () => {
      const inviter = await signup("sfx-race-inviter");
      const invited = await signup("sfx-race-invited");
      const code = await inviteCodeOf(inviter.accessToken);

      const results = await Promise.all([
        redeem(invited.accessToken, { code }),
        redeem(invited.accessToken, { code }),
      ]);
      expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
      expect(results.find((r) => r.status === 409)!.body.code).toBe("INVITE_ALREADY_REDEEMED");

      expect(await buddyRows(inviter.user.id, invited.user.id)).toEqual([
        { requester_id: invited.user.id, addressee_id: inviter.user.id, status: "PENDING" },
      ]);
      // the buddy path carries the news: exactly one notification, the via-invite one, no follow noise
      const inbox = await settledInbox(inviter.user.id);
      expect(inbox).toHaveLength(1);
      expect(inbox[0]).toMatchObject({ template: "buddyRequestedViaInvite", link_url: "/study-session" });
      expect(await followRows(inviter.user.id, invited.user.id)).toEqual([]);
    }, 30_000);

    it("the inviter is already paired: they follow each other, no buddy row, one 'joined' notification", async () => {
      const inviter = await signup("sfx-active-inviter");
      const partner = await signup("sfx-active-partner");
      const invited = await signup("sfx-active-invited");
      await serviceRows(
        "insert into buddy_pairs (requester_id, addressee_id, status) values ($1,$2,'ACTIVE') returning id",
        [inviter.user.id, partner.user.id],
      );
      const code = await inviteCodeOf(inviter.accessToken);

      await redeem(invited.accessToken, { code }).expect(201);

      expect(await buddyRows(inviter.user.id, invited.user.id)).toEqual([
        { requester_id: inviter.user.id, addressee_id: partner.user.id, status: "ACTIVE" },
      ]);
      const follows = await followRows(inviter.user.id, invited.user.id);
      expect(follows).toHaveLength(2);
      expect(follows).toEqual(
        expect.arrayContaining([
          { follower_id: inviter.user.id, followee_id: invited.user.id },
          { follower_id: invited.user.id, followee_id: inviter.user.id },
        ]),
      );
      const inbox = await settledInbox(inviter.user.id);
      expect(inbox).toHaveLength(1);
      expect(inbox[0]).toMatchObject({ template: "inviteJoined", category: "FORUM", link_url: "/settings" });
      expect(String(inbox[0]!.dedupe_key)).toMatch(/^invite-joined:[0-9a-f-]{36}$/);
      // silent follows: neither side hears "new follower"
      expect(await inviteInbox(invited.user.id)).toEqual([]);
    }, 30_000);

    it("the invited user already has a pending request: mutual follow instead of a second request", async () => {
      const inviter = await signup("sfx-pending-inviter");
      const other = await signup("sfx-pending-other");
      const invited = await signup("sfx-pending-invited");
      await serviceRows(
        "insert into buddy_pairs (requester_id, addressee_id, status) values ($1,$2,'PENDING') returning id",
        [other.user.id, invited.user.id],
      );
      const code = await inviteCodeOf(inviter.accessToken);

      await redeem(invited.accessToken, { code }).expect(201);

      expect(await buddyRows(inviter.user.id, invited.user.id)).toEqual([
        { requester_id: other.user.id, addressee_id: invited.user.id, status: "PENDING" },
      ]);
      expect(await followRows(inviter.user.id, invited.user.id)).toHaveLength(2);
      const inbox = await settledInbox(inviter.user.id);
      expect(inbox.map((r) => r.template)).toEqual(["inviteJoined"]);
    }, 30_000);
  });
});
