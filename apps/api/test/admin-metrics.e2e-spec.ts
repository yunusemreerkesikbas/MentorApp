import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { UserRole } from "@mentor/types";

const RUN = Date.now();
const PLAN_ID = `e2e-mplan-${RUN}`;
const CHARGE_MINOR = 19900;

/**
 * W6 admin metrics dashboard (e2e): ADMIN reads a cross-tenant KPI snapshot (users + subscriptions/
 * revenue + economy). Read-only; non-admin is 403. A subscription+charge is seeded so MRR > 0.
 */
describe("admin metrics dashboard (e2e)", () => {
  let app: INestApplication;
  let pool: Pool;
  let adminToken = "";
  let studentToken = "";

  const signup = async (label: string) => {
    const email = `am-${label}-${RUN}@test.local`;
    const res = await request(app.getHttpServer())
      .post("/v1/auth/signup")
      .send({ email, password: "Sifre1234", displayName: `AM ${label}`, kvkkAccepted: true });
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

  const seedCharge = (userId: string) =>
    svc(async (c) => {
      await c.query(
        `insert into plans (id,name,period_months,price_minor,currency,trial_days,is_active)
         values ($1,'E2E Metrics Plan',1,$2,'TRY',7,true) on conflict (id) do nothing`,
        [PLAN_ID, CHARGE_MINOR],
      );
      const sub = await c.query(
        `insert into subscriptions (user_id,plan_id,status,provider,provider_ref,current_period_start,current_period_end)
         values ($1,$2,'ACTIVE','FAKE',$3, now(), now() + interval '30 days') returning id`,
        [userId, PLAN_ID, `fake_m_${userId}`],
      );
      await c.query(
        `insert into payment_transactions (subscription_id,user_id,type,amount_minor,currency,status,provider_event_id)
         values ($1,$2,'RENEWAL',$3,'TRY','SUCCEEDED',$4)`,
        [sub.rows[0].id, userId, CHARGE_MINOR, `seed-m-charge-${RUN}`],
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
    const payer = await signup("payer");
    studentToken = student.accessToken;

    await grantRole(admin.user.id, UserRole.ADMIN);
    await seedCharge(payer.user.id);

    const login = await request(app.getHttpServer())
      .post("/v1/auth/login")
      .send({ email: admin.email, password: "Sifre1234" });
    adminToken = login.body.accessToken;
  }, 90_000);

  afterAll(async () => {
    await app?.close();
    await pool?.end();
  });

  it("rejects non-admin (403)", async () => {
    const res = await request(app.getHttpServer())
      .get("/v1/admin/metrics")
      .set({ Authorization: `Bearer ${studentToken}` });
    expect(res.status).toBe(403);
  });

  it("ADMIN reads the KPI snapshot (users + subscriptions + economy)", async () => {
    const res = await request(app.getHttpServer())
      .get("/v1/admin/metrics")
      .set({ Authorization: `Bearer ${adminToken}` });
    expect(res.status).toBe(200);

    // users — at least the 3 signed-up accounts exist
    expect(res.body.users.total).toBeGreaterThanOrEqual(3);
    expect(typeof res.body.users.byStatus.active).toBe("number");
    expect(typeof res.body.users.byExamType.kpss).toBe("number");

    // subscriptions/revenue — the seeded ACTIVE sub + SUCCEEDED renewal
    expect(res.body.subscriptions.byStatus.active).toBeGreaterThanOrEqual(1);
    expect(res.body.subscriptions.revenueMinor30d).toBeGreaterThanOrEqual(CHARGE_MINOR);
    expect(res.body.subscriptions.payingSubscriptions).toBeGreaterThanOrEqual(1);
    expect(res.body.subscriptions.conversionRate).toBeGreaterThan(0);

    // economy — shape present
    expect(typeof res.body.economy.coinIssued).toBe("number");
    expect(typeof res.body.economy.xpIssued).toBe("number");
    expect(typeof res.body.economy.invite.invited).toBe("number");

    expect(typeof res.body.generatedAt).toBe("string");
  });
});
