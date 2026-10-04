import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { UserRole } from "@mentor/types";
import { randomBytes } from "node:crypto";
import { EmailTokenRepository } from "../src/modules/identity/infrastructure/email-token.repository";
import { EmailTokenType } from "../src/modules/identity/domain/identity.constants";
import { hashToken } from "../src/modules/identity/application/token.service";

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
      .send({ email, password: "Sifre1234", displayName: `EQ ${label}`, kvkkAccepted: true, termsAccepted: true, ageEligibilityConfirmed: true });
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

  it("profile completion grants before GET, while retired quests stay disabled", async () => {
    expect((await balance()).coinConfirmed).toBe(10);
    const res = await request(app.getHttpServer()).get("/v1/economy/quests").set(asQuester());
    expect(res.status).toBe(200);
    const byId = Object.fromEntries(res.body.map((q: { id: string; completed: boolean }) => [q.id, q.completed]));
    expect(byId["onboarding.profile-setup"]).toBe(true);
    expect(byId["onboarding.first-subscription"]).toBeUndefined();
    expect(byId["onboarding.email-verified"]).toBe(false);
    expect(byId["onboarding.invite-redeemed"]).toBeUndefined();

    // Only profile setup grants Coin; subscription activation does not.
    expect((await balance()).coinConfirmed).toBe(10);
  });

  it("is idempotent — a second call grants nothing more", async () => {
    await request(app.getHttpServer()).get("/v1/economy/quests").set(asQuester());
    expect((await balance()).coinConfirmed).toBe(10);
  });

  it("receipts are self-scoped and acknowledgment leaves the ledger intact", async () => {
    const unseen = await request(app.getHttpServer()).get("/v1/economy/rewards/unseen").set(asQuester());
    expect(unseen.status).toBe(200);
    expect(unseen.body.total).toBe(1);
    const id = unseen.body.items[0].id;
    expect(unseen.body.items[0]).toMatchObject({ amount: 10, unit: "COIN", reason: "quest.onboarding.profile-setup" });
    await request(app.getHttpServer()).post("/v1/economy/rewards/seen")
      .set({ Authorization: `Bearer ${adminToken}` }).send({ ledgerIds: [id] }).expect(204);
    const stillUnseen = await request(app.getHttpServer()).get("/v1/economy/rewards/unseen").set(asQuester());
    expect(stillUnseen.body.total).toBe(1);
    await Promise.all([1, 2].map(() => request(app.getHttpServer()).post("/v1/economy/rewards/seen")
      .set(asQuester()).send({ ledgerIds: [id] }).expect(204)));
    const seen = await request(app.getHttpServer()).get("/v1/economy/rewards/unseen").set(asQuester());
    expect(seen.body.total).toBe(0);
    expect((await balance()).coinConfirmed).toBe(10);
    const ledger = await request(app.getHttpServer()).get("/v1/economy/ledger").set(asQuester());
    expect(ledger.body.some((entry: { id: string }) => entry.id === id)).toBe(true);
  });

  it("rejects disabled streak rescue through the API", async () => {
    await request(app.getHttpServer()).get("/v1/economy/streak-rescue").set(asQuester()).expect(404);
    await request(app.getHttpServer()).post("/v1/economy/streak-rescue").set(asQuester()).expect(404);
    expect((await balance()).coinConfirmed).toBe(10);
  });

  it("mood save grants XP without a quests read, once under concurrent repeats", async () => {
    await Promise.all([1, 2].map(() => request(app.getHttpServer()).post("/v1/coaching/mood-checkins")
      .set(asQuester()).send({ mood: 3 }).expect(200)));
    const ledger = await request(app.getHttpServer()).get("/v1/economy/ledger").set(asQuester());
    const mood = ledger.body.filter((row: { reason: string }) => row.reason === "quest.daily.mood-checkin");
    expect(mood).toHaveLength(1);
    expect(mood[0]).toMatchObject({ unit: "XP", amount: 5, title: "Görev XP’si" });
  });

  it("plan completion grants immediately and undo/re-complete cannot grant again", async () => {
    const task = await request(app.getHttpServer()).post("/v1/plan-tasks")
      .set(asQuester()).send({ title: "Economy action test" }).expect(201);
    const update = (status: string) => request(app.getHttpServer()).patch(`/v1/plan-tasks/${task.body.id}`)
      .set(asQuester()).send({ status }).expect(200);
    await update("DONE");
    await update("PENDING");
    await update("DONE");
    const ledger = await request(app.getHttpServer()).get("/v1/economy/ledger").set(asQuester());
    const grants = ledger.body.filter((row: { reason: string }) => row.reason === "quest.daily.plan-task-done");
    expect(grants).toHaveLength(1);
    expect(grants[0].amount).toBe(5);
  });

  it("session finalization grants XP without a quests read", async () => {
    const session = await request(app.getHttpServer()).post("/v1/study-sessions")
      .set(asQuester()).send({ preset: "25_5" }).expect(201);
    // The API validates elapsed wall time; make the test session old enough, without sleeping.
    await svc(async (c) => {
      await c.query("update study_sessions set started_at=now()-interval '30 minutes' where id=$1", [session.body.id]);
    });
    await request(app.getHttpServer()).patch(`/v1/study-sessions/${session.body.id}`)
      .set(asQuester()).send({ status: "COMPLETED", actualFocusSeconds: 1500 }).expect(200);
    const ledger = await request(app.getHttpServer()).get("/v1/economy/ledger").set(asQuester());
    expect(ledger.body.filter((row: { reason: string }) => row.reason === "quest.daily.focus-session-completed"))
      .toHaveLength(1);
  });

  it("404 when the economy feature flag is off", async () => {
    await setEconomyEnabled(false);
    const res = await request(app.getHttpServer()).get("/v1/economy/quests").set(asQuester());
    expect(res.status).toBe(404);
    await setEconomyEnabled(true); // restore for any later runs
  });

  it("verified email grants its own ten Coin exactly once", async () => {
    const token = randomBytes(32).toString("hex");
    await app.get(EmailTokenRepository).create({ userId: questerId, type: EmailTokenType.VERIFY_EMAIL,
      tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 60_000) });
    await request(app.getHttpServer()).post("/v1/auth/verify-email").send({ token }).expect(200);
    expect((await balance()).coinConfirmed).toBe(20);
    await request(app.getHttpServer()).post("/v1/auth/verify-email").send({ token }).expect(400);
    expect((await balance()).coinConfirmed).toBe(20);
  });

  it("disabled ranking still serves personal XP and level", async () => {
    await request(app.getHttpServer()).get("/v1/community/leaderboard").set(asQuester()).expect(404);
    const summary = await request(app.getHttpServer()).get("/v1/community/summary").set(asQuester()).expect(200);
    expect(summary.body.leaderboard).toBeNull();
    expect(summary.body.xp).toBeGreaterThan(0);
    expect(summary.body.level.tier).toBeGreaterThan(0);
  });
});
