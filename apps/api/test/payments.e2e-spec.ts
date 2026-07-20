import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import * as express from "express";
import { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { signFakeWebhook } from "../src/modules/payments/infrastructure/adapters/fake-payments.adapter";

const SECRET = "test-payments-webhook-secret"; // matches vitest env
// Event ids must be unique PER RUN: the idempotency belt persists in mentor_test across
// runs, so a reused id would be treated as a replay and silently not applied.
const RUN = Date.now();
const evt = (name: string) => `evt_${name}_${RUN}`;

/**
 * W4 payments e2e — full subscription lifecycle against a real Postgres (RLS active),
 * driven through the FakePaymentsAdapter + signed fake webhooks (no external provider).
 */
describe("payments (e2e)", () => {
  let app: INestApplication;
  let pool: Pool;
  let accessToken = "";
  let providerRef = "";

  /** SERVICE-context helper to seed an INCOMPLETE (verification-gate) row the fake provider can't produce. */
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

  beforeAll(async () => {
    process.env.DATABASE_URL =
      process.env.TEST_DATABASE_URL ?? "postgres://mentor:mentor@localhost:5433/mentor_test";
    pool = new Pool({ connectionString: process.env.DATABASE_URL });

    const { AppModule } = await import("../src/app.module");
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    app.setGlobalPrefix("v1");
    app.use(cookieParser());
    // Mirror main.ts: capture the raw body for webhook signature verification.
    app.use(
      express.json({
        verify: (req: { rawBody?: Buffer }, _res, buf: Buffer) => {
          req.rawBody = buf;
        },
      }),
    );
    await app.init();

    // Fresh user for the suite.
    const signup = await request(app.getHttpServer()).post("/v1/auth/signup").send({
      email: `w4-${Date.now()}@test.local`,
      password: "Sifre1234",
      displayName: "W4 Test",
      kvkkAccepted: true,
    });
    accessToken = signup.body.accessToken;
  }, 90_000); // cold module compile under load can exceed the global hookTimeout

  afterAll(async () => {
    await app?.close();
    await pool?.end();
  });

  const auth = () => ({ Authorization: `Bearer ${accessToken}` });
  const webhook = (type: Parameters<typeof signFakeWebhook>[1]["type"], extra?: object) => {
    const { body, headers } = signFakeWebhook(SECRET, {
      type,
      providerRef,
      amountMinor: 24900,
      ...extra,
    });
    return request(app.getHttpServer()).post("/v1/webhooks/payments").set(headers).send(JSON.parse(body));
  };

  it("plans are public and seeded (placeholder prices)", async () => {
    const res = await request(app.getHttpServer()).get("/v1/plans");
    expect(res.status).toBe(200);
    const ids = res.body.map((p: { id: string }) => p.id);
    expect(ids).toContain("premium-monthly");
    expect(res.body[0].priceMinor).toBeGreaterThan(0);
  });

  it("subscription endpoints require auth", async () => {
    expect((await request(app.getHttpServer()).get("/v1/subscription")).status).toBe(401);
  });

  it("fresh user is FREE", async () => {
    const res = await request(app.getHttpServer()).get("/v1/subscription").set(auth());
    expect(res.status).toBe(200);
    expect(res.body.subscription).toBeNull();
    expect(res.body.entitlement.isPremium).toBe(false);
  });

  it("checkout starts a TRIALING subscription → entitlement PREMIUM", async () => {
    const res = await request(app.getHttpServer())
      .post("/v1/subscription/checkout")
      .set(auth())
      .send({ planId: "premium-monthly" });
    expect(res.status).toBe(200);
    expect(res.body.checkoutUrl).toContain("status=success");

    const view = await request(app.getHttpServer()).get("/v1/subscription").set(auth());
    expect(view.body.subscription.status).toBe("TRIALING");
    expect(view.body.entitlement.isPremium).toBe(true);
    expect(view.body.entitlement.reason).toBe("TRIALING");
    providerRef = new URL(res.body.checkoutUrl).searchParams.get("ref")!;
  });

  it("second checkout while open → 409 PAYMENT_ALREADY_SUBSCRIBED", async () => {
    const res = await request(app.getHttpServer())
      .post("/v1/subscription/checkout")
      .set(auth())
      .send({ planId: "premium-monthly" });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("PAYMENT_ALREADY_SUBSCRIBED");
  });

  it("webhook with an invalid signature → 401, nothing processed", async () => {
    const res = await request(app.getHttpServer())
      .post("/v1/webhooks/payments")
      .set({ "x-fake-signature": "deadbeef", "content-type": "application/json" })
      .send({ eventId: "evt_bad", type: "payment_succeeded", providerRef });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("PAYMENT_WEBHOOK_INVALID");
  });

  it("payment_succeeded webhook → ACTIVE; replay is idempotent", async () => {
    // Capture the trial period end so we can assert the renewal extends (never shortens) it.
    const before = await request(app.getHttpServer()).get("/v1/subscription").set(auth());
    const priorPeriodEnd = new Date(before.body.subscription.currentPeriodEnd).getTime();

    const { body, headers } = signFakeWebhook(SECRET, {
      eventId: evt("renew"),
      type: "payment_succeeded",
      providerRef,
      amountMinor: 24900,
    });
    const first = await request(app.getHttpServer())
      .post("/v1/webhooks/payments")
      .set(headers)
      .send(JSON.parse(body));
    expect(first.status).toBe(200);
    expect(first.body.duplicate).toBe(false);

    // Exact replay — acknowledged but not re-applied.
    const replay = await request(app.getHttpServer())
      .post("/v1/webhooks/payments")
      .set(headers)
      .send(JSON.parse(body));
    expect(replay.body.duplicate).toBe(true);

    const view = await request(app.getHttpServer()).get("/v1/subscription").set(auth());
    expect(view.body.subscription.status).toBe("ACTIVE");
    expect(view.body.entitlement.reason).toBe("ACTIVE");
    // Renewal extends forward from the prior period end (review #2 — no lost paid time).
    expect(new Date(view.body.subscription.currentPeriodEnd).getTime()).toBeGreaterThan(priorPeriodEnd);
  });

  it("payment_failed → PAST_DUE but premium continues (grace, §7)", async () => {
    const res = await webhook("payment_failed", { eventId: evt("fail") });
    expect(res.status).toBe(200);

    const view = await request(app.getHttpServer()).get("/v1/subscription").set(auth());
    expect(view.body.subscription.status).toBe("PAST_DUE");
    expect(view.body.entitlement.isPremium).toBe(true);
    expect(view.body.entitlement.reason).toBe("GRACE");
  });

  it("self-serve cancel → CANCELED, access until period end, idempotent", async () => {
    const res = await request(app.getHttpServer()).post("/v1/subscription/cancel").set(auth());
    expect(res.status).toBe(200);
    expect(res.body.subscription.status).toBe("CANCELED");
    expect(res.body.subscription.cancelAtPeriodEnd).toBe(true);

    const again = await request(app.getHttpServer()).post("/v1/subscription/cancel").set(auth());
    expect(again.status).toBe(200); // idempotent
  });

  it("subscription_canceled webhook → EXPIRED → FREE", async () => {
    const res = await webhook("subscription_canceled", { eventId: evt("cancel") });
    expect(res.status).toBe(200);

    const view = await request(app.getHttpServer()).get("/v1/subscription").set(auth());
    expect(view.body.subscription).toBeNull(); // EXPIRED is terminal → no open subscription
    expect(view.body.entitlement.isPremium).toBe(false);
  });

  describe("STAFF role entitlement (team/beta — no subscription row)", () => {
    it("a STAFF user is PREMIUM without any subscription; payment stats stay clean", async () => {
      // Fresh user → promote to STAFF via SQL (assignment endpoint arrives with W6;
      // until then this same statement is the documented prod procedure).
      const staffEmail = `w4-staff-${RUN}@test.local`;
      await request(app.getHttpServer()).post("/v1/auth/signup").send({
        email: staffEmail,
        password: "Sifre1234",
        displayName: "W4 Staff",
        kvkkAccepted: true,
      });
      const pool = new Pool({ connectionString: process.env.DATABASE_URL });
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query("select set_config('app.role','SERVICE',true)");
        await client.query(
          "update users set roles='{STUDENT,STAFF}' where lower(email)=lower($1)",
          [staffEmail],
        );
        await client.query("COMMIT");
      } finally {
        client.release();
        await pool.end();
      }

      // Re-login so the JWT carries STAFF.
      const login = await request(app.getHttpServer())
        .post("/v1/auth/login")
        .send({ email: staffEmail, password: "Sifre1234" });
      const view = await request(app.getHttpServer())
        .get("/v1/subscription")
        .set({ Authorization: `Bearer ${login.body.accessToken}` });

      expect(view.status).toBe(200);
      expect(view.body.subscription).toBeNull(); // no row → billing stats unaffected
      expect(view.body.entitlement.isPremium).toBe(true);
      expect(view.body.entitlement.reason).toBe("STAFF");
      expect(view.body.entitlement.validUntil).toBeNull(); // role-bound, not time-boxed
    }, 30_000);
  });

  it("re-subscribe after expiry works WITHOUT a second trial (trial-once §7)", async () => {
    const res = await request(app.getHttpServer())
      .post("/v1/subscription/checkout")
      .set(auth())
      .send({ planId: "premium-monthly" });
    expect(res.status).toBe(200);

    const view = await request(app.getHttpServer()).get("/v1/subscription").set(auth());
    expect(view.body.subscription.status).toBe("ACTIVE"); // no TRIALING this time
    expect(view.body.subscription.trialEndsAt).toBeNull();
  });

  // Verification gate (real-iyzico path): the fake provider is instant, so an INCOMPLETE row is
  // seeded directly, then activated by a signed checkout_completed webhook.
  it("INCOMPLETE row grants no premium until checkout_completed activates it", async () => {
    const gateUser = await request(app.getHttpServer()).post("/v1/auth/signup").send({
      email: `w4-gate-${RUN}@test.local`,
      password: "Sifre1234",
      displayName: "W4 Gate",
      kvkkAccepted: true,
    });
    const gateAuth = { Authorization: `Bearer ${gateUser.body.accessToken}` };
    const gateUserId = gateUser.body.user.id as string;
    const gateRef = `fake_gate_${RUN}`;

    await svc(async (c) => {
      await c.query(
        `insert into subscriptions (user_id,plan_id,status,provider,provider_ref,current_period_start,current_period_end)
         values ($1,'premium-monthly','INCOMPLETE','IYZICO',$2, now(), now() + interval '30 days')`,
        [gateUserId, gateRef],
      );
    });

    // Before activation: the gate withholds premium (an abandoned payment page grants nothing).
    const before = await request(app.getHttpServer()).get("/v1/subscription").set(gateAuth);
    expect(before.body.subscription.status).toBe("INCOMPLETE");
    expect(before.body.entitlement.isPremium).toBe(false);
    expect(before.body.entitlement.reason).toBe("INCOMPLETE");

    // Signed checkout_completed → ACTIVE + premium.
    const { body, headers } = signFakeWebhook(SECRET, {
      eventId: evt("gate"),
      type: "checkout_completed",
      providerRef: gateRef,
    });
    const hook = await request(app.getHttpServer())
      .post("/v1/webhooks/payments")
      .set(headers)
      .send(JSON.parse(body));
    expect(hook.status).toBe(200);

    const after = await request(app.getHttpServer()).get("/v1/subscription").set(gateAuth);
    expect(after.body.subscription.status).toBe("ACTIVE");
    expect(after.body.entitlement.isPremium).toBe(true);
  });
});
