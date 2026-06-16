import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { UserRole } from "@mentor/types";

const RUN = Date.now();
const PLAN_ID = `e2e-rbacplan-${RUN}`;

/**
 * W6 fine admin sub-roles (e2e): each scoped role reaches only its surface; ADMIN/SUPER_ADMIN are
 * the umbrella (guard bypass). Role assignment is SUPER_ADMIN-only and allowlist-guarded (no
 * SUPER_ADMIN self-escalation). Against a real Postgres (RLS active).
 */
describe("admin fine sub-roles RBAC (e2e)", () => {
  let app: INestApplication;
  let pool: Pool;
  const tokens: Record<string, string> = {};
  let targetId = ""; // a plain user with a seeded charge (refund target + role-assign target)

  const signup = async (label: string) => {
    const email = `rbac-${label}-${RUN}@test.local`;
    const res = await request(app.getHttpServer())
      .post("/v1/auth/signup")
      .send({ email, password: "Sifre1234", displayName: `RBAC ${label}`, kvkkAccepted: true });
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

  /** Signup + grant a role + login so the JWT carries that role. */
  const makeActor = async (label: string, role: string): Promise<void> => {
    const u = await signup(label);
    await grantRole(u.user.id, role);
    const login = await request(app.getHttpServer())
      .post("/v1/auth/login")
      .send({ email: u.email, password: "Sifre1234" });
    tokens[label] = login.body.accessToken;
  };

  const seedCharge = (userId: string) =>
    svc(async (c) => {
      await c.query(
        `insert into plans (id,name,period_months,price_minor,currency,trial_days,is_active)
         values ($1,'RBAC Plan',1,19900,'TRY',7,true) on conflict (id) do nothing`,
        [PLAN_ID],
      );
      const sub = await c.query(
        `insert into subscriptions (user_id,plan_id,status,provider,provider_ref,current_period_start,current_period_end)
         values ($1,$2,'ACTIVE','FAKE',$3, now(), now() + interval '30 days') returning id`,
        [userId, PLAN_ID, `fake_rbac_${userId}`],
      );
      await c.query(
        `insert into payment_transactions (subscription_id,user_id,type,amount_minor,currency,status,provider_event_id)
         values ($1,$2,'RENEWAL',19900,'TRY','SUCCEEDED',$3)`,
        [sub.rows[0].id, userId, `seed-rbac-${RUN}`],
      );
    });

  const auth = (label: string) => ({ Authorization: `Bearer ${tokens[label]}` });

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

    await makeActor("support", UserRole.SUPPORT);
    await makeActor("finance", UserRole.FINANCE);
    await makeActor("super", UserRole.SUPER_ADMIN);
    await makeActor("admin", UserRole.ADMIN);

    const target = await signup("target");
    targetId = target.user.id;
    await seedCharge(targetId);
  }, 90_000);

  afterAll(async () => {
    await app?.close();
    await pool?.end();
  });

  it("SUPPORT: can list users, cannot read config, cannot refund", async () => {
    expect((await request(app.getHttpServer()).get("/v1/admin/users").set(auth("support"))).status).toBe(200);
    expect((await request(app.getHttpServer()).get("/v1/admin/config").set(auth("support"))).status).toBe(403);
    const refund = await request(app.getHttpServer())
      .post(`/v1/admin/users/${targetId}/subscription/refund`)
      .set(auth("support"))
      .send({ amountMinor: 100, reason: "x" });
    expect(refund.status).toBe(403);
  });

  it("FINANCE: can view+refund subscription, cannot read config", async () => {
    expect(
      (await request(app.getHttpServer()).get(`/v1/admin/users/${targetId}/subscription`).set(auth("finance"))).status,
    ).toBe(200);
    const refund = await request(app.getHttpServer())
      .post(`/v1/admin/users/${targetId}/subscription/refund`)
      .set(auth("finance"))
      .send({ amountMinor: 5000, reason: "müşteri talebi" });
    expect(refund.status).toBe(201);
    expect((await request(app.getHttpServer()).get("/v1/admin/config").set(auth("finance"))).status).toBe(403);
  });

  it("ADMIN (legacy) is the umbrella — reaches config via guard bypass", async () => {
    expect((await request(app.getHttpServer()).get("/v1/admin/config").set(auth("admin"))).status).toBe(200);
  });

  it("SUPER_ADMIN: config + audit-log + can assign a sub-role", async () => {
    expect((await request(app.getHttpServer()).get("/v1/admin/config").set(auth("super"))).status).toBe(200);
    expect((await request(app.getHttpServer()).get("/v1/admin/audit-log").set(auth("super"))).status).toBe(200);

    const assign = await request(app.getHttpServer())
      .post(`/v1/admin/users/${targetId}/roles/FINANCE`)
      .set(auth("super"));
    expect(assign.status).toBe(201);
    expect(assign.body.roles).toContain("FINANCE");
  });

  it("SUPER_ADMIN cannot assign SUPER_ADMIN via API (allowlist → 400)", async () => {
    const res = await request(app.getHttpServer())
      .post(`/v1/admin/users/${targetId}/roles/SUPER_ADMIN`)
      .set(auth("super"));
    expect(res.status).toBe(400);
  });

  it("role assignment is SUPER_ADMIN-only (SUPPORT → 403)", async () => {
    const res = await request(app.getHttpServer())
      .post(`/v1/admin/users/${targetId}/roles/MODERATOR`)
      .set(auth("support"));
    expect(res.status).toBe(403);
  });
});
