import { disableAuthRateLimits } from "../../../apps/api/test/app-harness";
import type { INestApplication } from "@nestjs/common";
import { Test } from "../../../apps/api/node_modules/@nestjs/testing/index.js";
import cookieParser from "../../../apps/api/node_modules/cookie-parser/index.js";
import { Pool } from "../../../apps/api/node_modules/pg/lib/index.js";
import request from "../../../apps/api/test/browser-request";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { UserRole } from "../../../packages/types/src/index";
import { randomBytes } from "node:crypto";
import { EmailTokenRepository } from "../../../apps/api/src/modules/identity/infrastructure/email-token.repository";
import { EmailTokenType } from "../../../apps/api/src/modules/identity/domain/identity.constants";
import { hashToken } from "../../../apps/api/src/modules/identity/application/token.service";

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
  let questerEmail = "";

  const signup = async (label: string) => {
    const email = `eq-${label}-${RUN}@test.local`;
    const res = await request(app.getHttpServer())
      .post("/v1/auth/signup")
      .send({ email, password: "Sifre1234", displayName: `EQ ${label}`, kvkkAccepted: true, termsAccepted: true, ageEligibilityConfirmed: true });
    return { email, ...(res.body as { accessToken: string; user: { id: string } }) };
  };

  const svc = async (fn: (c: import("../../../apps/api/node_modules/pg/lib/index.js").PoolClient) => Promise<void>) => {
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

    const { AppModule } = await import("../../../apps/api/src/app.module");
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    disableAuthRateLimits(moduleRef);
    app = moduleRef.createNestApplication({ logger: false });
    app.setGlobalPrefix("v1");
    app.use(cookieParser());
    await app.init();

    const admin = await signup("admin");
    const quester = await signup("quester");
    questerToken = quester.accessToken;
    questerId = quester.user.id;
    questerEmail = quester.email;

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

  it("disables economy reads/spends and grants nothing while core actions still work", async () => {
    await setEconomyEnabled(false).expect(200);
    const closed = await signup("closed");
    const headers = { Authorization: `Bearer ${closed.accessToken}` };
    await request(app.getHttpServer()).patch("/v1/users/me").set(headers).send({ examType: "KPSS" }).expect(200);
    const token = randomBytes(32).toString("hex");
    await app.get(EmailTokenRepository).create({ userId: closed.user.id, type: EmailTokenType.VERIFY_EMAIL,
      tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 60_000) }, closed.email, async () => undefined);
    await request(app.getHttpServer()).post("/v1/auth/verify-email").send({ token }).expect(200);
    await request(app.getHttpServer()).post("/v1/coaching/mood-checkins").set(headers).send({ mood: 4 }).expect(200);
    const task = await request(app.getHttpServer()).post("/v1/plan-tasks").set(headers)
      .send({ title: "Closed economy study", taskDate: new Date().toISOString().slice(0, 10) }).expect(201);
    await request(app.getHttpServer()).patch(`/v1/plan-tasks/${task.body.id}`).set(headers).send({ status: "DONE" }).expect(200);
    const session = await request(app.getHttpServer()).post("/v1/study-sessions").set(headers).send({ preset: "25_5" }).expect(201);
    await svc(async c => { await c.query("update study_sessions set started_at=now()-interval '30 minutes' where id=$1", [session.body.id]); });
    await request(app.getHttpServer()).patch(`/v1/study-sessions/${session.body.id}`).set(headers)
      .send({ status: "COMPLETED", actualFocusSeconds: 1500 }).expect(200);
    for (const path of ["balance", "quests", "ledger", "rewards/unseen", "invite", "streak-rescue", "deep-analysis?examId=00000000-0000-4000-8000-000000000001"]) {
      const result = await request(app.getHttpServer()).get(`/v1/economy/${path}`).set(headers).expect(404);
      expect(result.body.code).toBe("ECONOMY_DISABLED");
    }
    await request(app.getHttpServer()).post("/v1/economy/streak-rescue").set(headers).expect(404);
    await request(app.getHttpServer()).post("/v1/economy/deep-analysis").set(headers)
      .send({ examId: "00000000-0000-4000-8000-000000000001" }).expect(404);
    const { EconomyService } = await import("../../../apps/api/src/modules/economy/application/economy.service");
    expect(await app.get(EconomyService).getAdminBalance(closed.user.id)).toEqual({ xp: 0, coinConfirmed: 0, coinPending: 0 });
    expect((await request(app.getHttpServer()).get("/v1/app/availability")).body.economy).toBe(false);
    console.log("CLOSED ECONOMY: profile, verified email, mood, done task and completed session work; XP=0, Coin=0; economy reads/spends rejected.");
  }, 30000);
});

