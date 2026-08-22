import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CommunityBadgeId, UserRole } from "@mentor/types";

const RUN = Date.now();

/**
 * Community effort board (e2e) against a real Postgres (RLS active). Covers graceful degradation
 * (economy off → leaderboard null, badges still present) and the weekly XP leaderboard once the
 * economy is enabled and the ledger is seeded. Ranks XP only — never net/results (§3).
 */
describe("community summary (e2e)", () => {
  let app: INestApplication;
  let pool: Pool;
  let adminToken = "";
  let userToken = "";
  let userId = "";

  const signup = async (label: string) => {
    const email = `community-${label}-${RUN}@test.local`;
    const res = await request(app.getHttpServer())
      .post("/v1/auth/signup")
      .send({ email, password: "Sifre1234", displayName: `Community ${label}`, kvkkAccepted: true });
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

  const setEconomyEnabled = (enabled: boolean) =>
    request(app.getHttpServer())
      .patch("/v1/admin/config/economy.enabled")
      .set({ Authorization: `Bearer ${adminToken}` })
      .send({ value: enabled });

  const summary = () =>
    request(app.getHttpServer()).get("/v1/community/summary").set({ Authorization: `Bearer ${userToken}` });

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
    const user = await signup("user");
    userToken = user.accessToken;
    userId = user.user.id;

    await svc(async (c) => {
      await c.query("update users set roles = array_append(roles,$1) where id=$2", [
        UserRole.ADMIN,
        admin.user.id,
      ]);
    });
    const login = await request(app.getHttpServer())
      .post("/v1/auth/login")
      .send({ email: admin.email, password: "Sifre1234" });
    adminToken = login.body.accessToken;
  }, 90_000);

  afterAll(async () => {
    await app?.close();
    await pool?.end();
  });

  it("degrades gracefully when the economy is off (badges yes, leaderboard no)", async () => {
    await setEconomyEnabled(false);
    const res = await summary();
    expect(res.status).toBe(200);
    expect(res.body.economyEnabled).toBe(false);
    expect(res.body.leaderboard).toBeNull();
    expect(res.body.xp).toBeNull();
    // A freshly-signed-up user is within the newcomer window.
    expect(res.body.badges).toContain(CommunityBadgeId.NEWCOMER);
  });

  it("ranks the user by weekly XP once the economy is enabled", async () => {
    await setEconomyEnabled(true);
    await svc(async (c) => {
      await c.query(
        "insert into ledger_entries (user_id, unit, amount, reason, status) values ($1,'XP',$2,'test.seed','CONFIRMED')",
        [userId, 100],
      );
    });

    const res = await summary();
    expect(res.status).toBe(200);
    expect(res.body.economyEnabled).toBe(true);
    expect(res.body.xp).toBeGreaterThanOrEqual(100);
    expect(res.body.leaderboard.window).toBe("weekly");
    // Shared test DB: parallel suites may push this user out of the top-10 items —
    // fall back to the `me` standing (same pattern as the windowed-leaderboard test below).
    const me =
      res.body.leaderboard.items.find((e: { isMe: boolean }) => e.isMe) ??
      res.body.leaderboard.me;
    expect(me?.xp).toBeGreaterThanOrEqual(100);
    // Phase 2: percentile denominator + avatar field on each row.
    expect(res.body.leaderboard.totalParticipants).toBeGreaterThanOrEqual(1);
    expect(me).toHaveProperty("avatarUrl");
  });

  it("serves the windowed leaderboard endpoint (Phase 3 tabs)", async () => {
    const res = await request(app.getHttpServer())
      .get("/v1/community/leaderboard?window=all_time")
      .set({ Authorization: `Bearer ${userToken}` });
    expect(res.status).toBe(200);
    expect(res.body.window).toBe("all_time");
    expect(Array.isArray(res.body.items)).toBe(true);
    const me = res.body.items.find((e: { isMe: boolean }) => e.isMe) ?? res.body.me;
    expect(me?.xp).toBeGreaterThanOrEqual(100); // seeded in the previous test, within all_time
    // all_time has no meaningful movement → null.
    expect(me?.movement).toBeNull();

    // Movement is always present and a valid signal (exact value depends on prior-period data, which
    // isn't deterministic against a shared test DB — the suppression logic is unit-tested separately).
    const weekly = await request(app.getHttpServer())
      .get("/v1/community/leaderboard?window=weekly")
      .set({ Authorization: `Bearer ${userToken}` });
    const weeklyMe =
      weekly.body.items.find((e: { isMe: boolean }) => e.isMe) ?? weekly.body.me;
    expect(weeklyMe).toHaveProperty("movement");
    expect([null, "up", "down", "same", "new"]).toContain(weeklyMe.movement);

    // Unknown window coerces to weekly (safe default).
    const bad = await request(app.getHttpServer())
      .get("/v1/community/leaderboard?window=garbage")
      .set({ Authorization: `Bearer ${userToken}` });
    expect(bad.status).toBe(200);
    expect(bad.body.window).toBe("weekly");
  });

  it("delivers and acknowledges the journey introduction only for its owner", async () => {
    await setEconomyEnabled(true);
    const unseen = await request(app.getHttpServer())
      .get("/v1/community/journey-levels/unseen")
      .set({ Authorization: `Bearer ${userToken}` });

    expect(unseen.status).toBe(200);
    expect(unseen.body.celebrations).toHaveLength(1);
    expect(unseen.body.celebrations[0]).toMatchObject({
      kind: "INTRODUCTION",
      tier: 2,
      key: "trail",
      chapter: "awakening",
    });
    const celebrationId = unseen.body.celebrations[0].id as string;

    const foreignAck = await request(app.getHttpServer())
      .post("/v1/community/journey-levels/celebrated")
      .set({ Authorization: `Bearer ${adminToken}` })
      .send({ celebrationId });
    expect(foreignAck.status).toBe(204);

    const stillUnseen = await request(app.getHttpServer())
      .get("/v1/community/journey-levels/unseen")
      .set({ Authorization: `Bearer ${userToken}` });
    expect(stillUnseen.body.celebrations.map((item: { id: string }) => item.id)).toContain(
      celebrationId,
    );

    const ownerAck = await request(app.getHttpServer())
      .post("/v1/community/journey-levels/celebrated")
      .set({ Authorization: `Bearer ${userToken}` })
      .send({ celebrationId });
    expect(ownerAck.status).toBe(204);

    const repeatAck = await request(app.getHttpServer())
      .post("/v1/community/journey-levels/celebrated")
      .set({ Authorization: `Bearer ${userToken}` })
      .send({ celebrationId });
    expect(repeatAck.status).toBe(204);

    const resolved = await request(app.getHttpServer())
      .get("/v1/community/journey-levels/unseen")
      .set({ Authorization: `Bearer ${userToken}` });
    expect(resolved.body).toEqual({ celebrations: [] });
  });

  it("returns an empty journey celebration collection while economy is disabled", async () => {
    await setEconomyEnabled(false);

    const response = await request(app.getHttpServer())
      .get("/v1/community/journey-levels/unseen")
      .set({ Authorization: `Bearer ${userToken}` });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ celebrations: [] });
  });
});
