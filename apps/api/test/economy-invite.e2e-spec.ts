import { JobRunnerService } from "../src/modules/notifications/application/job-runner.service";
import { SubscriptionsService } from "../src/modules/payments/application/subscriptions.service";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import * as express from "express";
import { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { UserRole } from "@mentor/types";
import { signFakeWebhook } from "../src/modules/payments/infrastructure/adapters/fake-payments.adapter";

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

  beforeAll(async () => {
    process.env.DATABASE_URL =
      process.env.TEST_DATABASE_URL ?? "postgres://mentor:mentor@localhost:5433/mentor_test";
    pool = new Pool({ connectionString: process.env.DATABASE_URL });

    const { AppModule } = await import("../src/app.module");
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
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
    expect(res.body.code).toMatch(/^MENTOR-/);
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
      .send({ code: "MENTOR-DEADBEEF" });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("INVITE_CODE_INVALID");
  });

  it("invited redeems (PENDING) and can't redeem twice", async () => {
    const ok = await request(app.getHttpServer())
      .post("/v1/economy/invite/redeem")
      .set(auth(burakToken))
      .send({ code });
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
      .send({ planId: "premium-monthly" });
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
    const invite = await request(app.getHttpServer()).get("/v1/economy/invite").set(auth(inviter.accessToken));
    await request(app.getHttpServer()).post("/v1/economy/invite/redeem")
      .set(auth(invited.accessToken)).send({ code: invite.body.code }).expect(201);
    const checkout = await request(app.getHttpServer()).post("/v1/subscription/checkout")
      .set(auth(invited.accessToken)).send({ planId: "premium-monthly" }).expect(200);
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
});
