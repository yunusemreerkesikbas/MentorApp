import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { UserRole } from "@mentor/types";

const RUN = Date.now();
const PLAN_ID = `e2e-qplan-${RUN}`;

/**
 * W6 economy onboarding quests (e2e): with economy enabled, completing onboarding conditions
 * (profile + first subscription) auto-grants capped coin via GET /economy/quests — idempotent on
 * repeat. Gated by economy.enabled. Against a real Postgres (RLS active).
 */
describe("economy onboarding quests (e2e)", () => {
  let app: INestApplication;
  let pool: Pool;
  let adminToken = "";
  let questerToken = "";
  let questerId = "";

  const signup = async (label: string) => {
    const email = `eq-${label}-${RUN}@test.local`;
    const res = await request(app.getHttpServer())
      .post("/v1/auth/signup")
      .send({ email, password: "Sifre1234", displayName: `EQ ${label}`, kvkkAccepted: true });
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

  const seedSubscription = (userId: string) =>
    svc(async (c) => {
      await c.query(
        `insert into plans (id,name,period_months,price_minor,currency,trial_days,is_active)
         values ($1,'EQ Plan',1,19900,'TRY',7,true) on conflict (id) do nothing`,
        [PLAN_ID],
      );
      await c.query(
        `insert into subscriptions (user_id,plan_id,status,provider,provider_ref,current_period_start,current_period_end)
         values ($1,$2,'ACTIVE','FAKE',$3, now(), now() + interval '30 days')`,
        [userId, PLAN_ID, `fake_q_${userId}`],
      );
    });

  const setEconomyEnabled = (enabled: boolean) =>
    request(app.getHttpServer())
      .patch("/v1/admin/config/economy.enabled")
      .set({ Authorization: `Bearer ${adminToken}` })
      .send({ value: enabled });

  const asQuester = () => ({ Authorization: `Bearer ${questerToken}` });

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
    const quester = await signup("quester");
    questerToken = quester.accessToken;
    questerId = quester.user.id;

    await grantRole(admin.user.id, UserRole.ADMIN);
    const login = await request(app.getHttpServer())
      .post("/v1/auth/login")
      .send({ email: admin.email, password: "Sifre1234" });
    adminToken = login.body.accessToken;

    await setEconomyEnabled(true);

    // Satisfy two onboarding conditions: profile (examType) + first subscription.
    await request(app.getHttpServer()).patch("/v1/users/me").set(asQuester()).send({ examType: "KPSS" });
    await seedSubscription(questerId);
  }, 90_000);

  afterAll(async () => {
    await app?.close();
    await pool?.end();
  });

  const balance = async (): Promise<{ coinConfirmed: number }> => {
    const res = await request(app.getHttpServer()).get("/v1/economy/balance").set(asQuester());
    return res.body;
  };

  it("GET /economy/quests evaluates + auto-grants completed onboarding quests", async () => {
    const res = await request(app.getHttpServer()).get("/v1/economy/quests").set(asQuester());
    expect(res.status).toBe(200);
    const byId = Object.fromEntries(res.body.map((q: { id: string; completed: boolean }) => [q.id, q.completed]));
    expect(byId["onboarding.profile-setup"]).toBe(true);
    expect(byId["onboarding.first-subscription"]).toBe(true);
    expect(byId["onboarding.email-verified"]).toBe(false);
    expect(byId["onboarding.invite-redeemed"]).toBe(false);

    // Two quests × default reward (10) = 20 coin (under the daily cap of 50).
    expect((await balance()).coinConfirmed).toBe(20);
  });

  it("is idempotent — a second call grants nothing more", async () => {
    await request(app.getHttpServer()).get("/v1/economy/quests").set(asQuester());
    expect((await balance()).coinConfirmed).toBe(20);
  });

  it("404 when the economy feature flag is off", async () => {
    await setEconomyEnabled(false);
    const res = await request(app.getHttpServer()).get("/v1/economy/quests").set(asQuester());
    expect(res.status).toBe(404);
    await setEconomyEnabled(true); // restore for any later runs
  });
});
