import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { UserRole } from "@mentor/types";

const RUN = Date.now();
const PLAN_ID = `e2e-plan-${RUN}`;
const CHARGE_MINOR = 24900;

/**
 * W6 admin subscription view + refund (e2e): ADMIN reads a user's subscription/entitlement/ledger
 * and issues a record-only refund (capped to the last charge) + a cancel — against a real Postgres
 * (RLS active). Charge state is seeded directly in SERVICE context (no webhook signature dance).
 */
describe("admin subscription + refund (e2e)", () => {
  let app: INestApplication;
  let pool: Pool;
  let adminToken = "";
  let studentToken = "";
  let subUserId = ""; // a user with a seeded ACTIVE subscription + charge

  const signup = async (label: string) => {
    const email = `as-${label}-${RUN}@test.local`;
    const res = await request(app.getHttpServer())
      .post("/v1/auth/signup")
      .send({ email, password: "Sifre1234", displayName: `AS ${label}`, kvkkAccepted: true });
    return { email, ...(res.body as { accessToken: string; user: { id: string } }) };
  };

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

  const grantRole = (userId: string, role: string) =>
    svc(async (c) => {
      await c.query("update users set roles = array_append(roles,$1) where id=$2", [role, userId]);
    });

  /** Seed a plan + ACTIVE subscription + one SUCCEEDED RENEWAL charge for `userId`. */
  const seedSubscription = (userId: string) =>
    svc(async (c) => {
      await c.query(
        `insert into plans (id,name,period_months,price_minor,currency,trial_days,is_active)
         values ($1,'E2E Plan',1,$2,'TRY',7,true) on conflict (id) do nothing`,
        [PLAN_ID, CHARGE_MINOR],
      );
      const sub = await c.query(
        `insert into subscriptions (user_id,plan_id,status,provider,provider_ref,current_period_start,current_period_end)
         values ($1,$2,'ACTIVE','FAKE',$3, now(), now() + interval '30 days') returning id`,
        [userId, PLAN_ID, `fake_${userId}`],
      );
      const subId = sub.rows[0].id as string;
      await c.query(
        `insert into payment_transactions (subscription_id,user_id,type,amount_minor,currency,status,provider_event_id)
         values ($1,$2,'RENEWAL',$3,'TRY','SUCCEEDED',$4)`,
        [subId, userId, CHARGE_MINOR, `seed-charge-${RUN}`],
      );
    });

  beforeAll(async () => {
    process.env.DATABASE_URL =
      process.env.TEST_DATABASE_URL ?? "postgres://mentor:mentor@localhost:5433/mentor_test";
    pool = new Pool({ connectionString: process.env.DATABASE_URL });

    const { AppModule } = await import("../src/app.module");
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    app.setGlobalPrefix("v1");
    app.use(cookieParser());
    await app.init();

    const admin = await signup("admin");
    const student = await signup("student");
    const subUser = await signup("subuser");
    studentToken = student.accessToken;
    subUserId = subUser.user.id;

    await grantRole(admin.user.id, UserRole.ADMIN);
    await seedSubscription(subUserId);

    const login = await request(app.getHttpServer())
      .post("/v1/auth/login")
      .send({ email: admin.email, password: "Sifre1234" });
    adminToken = login.body.accessToken;
  }, 90_000);

  afterAll(async () => {
    await app?.close();
    await pool?.end();
  });

  const asAdmin = () => ({ Authorization: `Bearer ${adminToken}` });

  const auditCount = async (action: string, targetId: string): Promise<number> => {
    const c = await pool.connect();
    try {
      await c.query("select set_config('app.role','SERVICE',true)");
      const res = await c.query(
        "select count(*)::int as n from admin_audit_log where action=$1 and target_id=$2",
        [action, targetId],
      );
      return res.rows[0]?.n ?? 0;
    } finally {
      c.release();
    }
  };

  it("rejects non-admin (403)", async () => {
    const res = await request(app.getHttpServer())
      .get(`/v1/admin/users/${subUserId}/subscription`)
      .set({ Authorization: `Bearer ${studentToken}` });
    expect(res.status).toBe(403);
  });

  it("ADMIN reads the subscription view (subscription + plan + entitlement + ledger)", async () => {
    const res = await request(app.getHttpServer())
      .get(`/v1/admin/users/${subUserId}/subscription`)
      .set(asAdmin());
    expect(res.status).toBe(200);
    expect(res.body.subscription?.status).toBe("ACTIVE");
    expect(res.body.plan?.priceMinor).toBe(CHARGE_MINOR);
    expect(res.body.entitlement?.isPremium).toBe(true);
    expect(res.body.transactions.some((t: { type: string }) => t.type === "RENEWAL")).toBe(true);
  });

  it("rejects a refund that exceeds the last charge (400)", async () => {
    const res = await request(app.getHttpServer())
      .post(`/v1/admin/users/${subUserId}/subscription/refund`)
      .set(asAdmin())
      .send({ amountMinor: CHARGE_MINOR + 1, reason: "too much" });
    expect(res.status).toBe(400);
  });

  it("ADMIN issues a partial refund; ledger gets a negative REFUND row; audited", async () => {
    const res = await request(app.getHttpServer())
      .post(`/v1/admin/users/${subUserId}/subscription/refund`)
      .set(asAdmin())
      .send({ amountMinor: 10000, reason: "müşteri talebi" });
    expect(res.status).toBe(201);
    const refund = res.body.transactions.find((t: { type: string }) => t.type === "REFUND");
    expect(refund).toBeDefined();
    expect(refund.amountMinor).toBe(-10000);
    expect(refund.status).toBe("REFUNDED");

    expect(await auditCount("subscription.refund", subUserId)).toBeGreaterThan(0);

    // The provider refund was invoked (before the ledger append) and its ref recorded: the fake
    // adapter embeds the Idempotency-Key (the admin-refund event id) in the ref it returns.
    const c = await pool.connect();
    try {
      await c.query("select set_config('app.role','SERVICE',true)");
      const row = await c.query(
        "select provider_event_id, raw from payment_transactions where user_id=$1 and type='REFUND' order by created_at desc limit 1",
        [subUserId],
      );
      const eventId = row.rows[0]?.provider_event_id as string;
      const rawRefundRef = row.rows[0]?.raw?.refundRef as string;
      expect(eventId.startsWith("admin-refund:")).toBe(true);
      expect(rawRefundRef).toBe(`fake_refund_${eventId}`); // provider.refund(providerRef, amount, key)
    } finally {
      c.release();
    }
  });

  it("caps cumulative refunds to the charge (remaining only)", async () => {
    // 10000 already refunded; remaining is CHARGE_MINOR-10000. One kuruş more must fail.
    const over = await request(app.getHttpServer())
      .post(`/v1/admin/users/${subUserId}/subscription/refund`)
      .set(asAdmin())
      .send({ amountMinor: CHARGE_MINOR - 10000 + 1, reason: "over remaining" });
    expect(over.status).toBe(400);
  });

  it("returns 409 when refunding a user with no successful charge", async () => {
    const noChargeUser = await signup("nocharge");
    const res = await request(app.getHttpServer())
      .post(`/v1/admin/users/${noChargeUser.user.id}/subscription/refund`)
      .set(asAdmin())
      .send({ amountMinor: 100, reason: "x" });
    expect(res.status).toBe(409);
  });

  it("ADMIN cancels the subscription; status becomes CANCELED; audited", async () => {
    const res = await request(app.getHttpServer())
      .post(`/v1/admin/users/${subUserId}/subscription/cancel`)
      .set(asAdmin());
    expect(res.status).toBe(200);
    expect(res.body.subscription?.status).toBe("CANCELED");
    expect(res.body.subscription?.cancelAtPeriodEnd).toBe(true);

    expect(await auditCount("subscription.cancel", subUserId)).toBeGreaterThan(0);
  });
});
