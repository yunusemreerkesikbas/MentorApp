import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { UserRole } from "@mentor/types";
import { buildSystemPrompt } from "../src/modules/ai/domain/ai.constants";

const RUN = Date.now();

/**
 * W3 AI coach chat slice 1 (e2e, fake LLM): premium-gated single-turn chat, ai.enabled kill-switch,
 * daily rate-limit, usage metering. Real Postgres (RLS active). §4 #1 refusal verified on the prompt.
 */
describe("ai coach chat (e2e)", () => {
  let app: INestApplication;
  let pool: Pool;
  let freeToken = "";
  let premiumToken = "";
  let premiumId = "";
  let adminToken = "";

  const signup = async (label: string) => {
    const email = `ai-${label}-${RUN}@test.local`;
    const res = await request(app.getHttpServer())
      .post("/v1/auth/signup")
      .send({ email, password: "Sifre1234", displayName: `AI ${label}`, kvkkAccepted: true });
    return { email, ...(res.body as { accessToken: string; user: { id: string } }) };
  };

  const grantRole = async (userId: string, role: string) => {
    const c = await pool.connect();
    try {
      await c.query("begin");
      await c.query("select set_config('app.role','SERVICE',true)");
      await c.query("update users set roles = array_append(roles,$1) where id=$2", [role, userId]);
      await c.query("commit");
    } finally {
      c.release();
    }
  };

  const login = async (email: string): Promise<string> => {
    const res = await request(app.getHttpServer())
      .post("/v1/auth/login")
      .send({ email, password: "Sifre1234" });
    return res.body.accessToken;
  };

  const setConfig = (key: string, value: unknown) =>
    request(app.getHttpServer())
      .patch(`/v1/admin/config/${key}`)
      .set({ Authorization: `Bearer ${adminToken}` })
      .send({ value });

  const aiUsageCount = async (userId: string): Promise<number> => {
    const c = await pool.connect();
    try {
      await c.query("select set_config('app.role','SERVICE',true)");
      const res = await c.query("select count(*)::int as n from ai_usage where user_id=$1", [userId]);
      return res.rows[0]?.n ?? 0;
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
    await app.init();

    const free = await signup("free");
    freeToken = free.accessToken;

    const premium = await signup("premium");
    premiumId = premium.user.id;
    await grantRole(premiumId, UserRole.STAFF); // STAFF = always-premium entitlement
    premiumToken = await login(premium.email);

    const admin = await signup("admin");
    await grantRole(admin.user.id, UserRole.ADMIN);
    adminToken = await login(admin.email);
  }, 90_000);

  afterAll(async () => {
    await app?.close();
    await pool?.end();
  });

  const chat = (token: string, message = "Bugün nasıl çalışmalıyım?") =>
    request(app.getHttpServer()).post("/v1/coach/chat").set({ Authorization: `Bearer ${token}` }).send({ message });

  it("§4 #1: the system prompt forbids generating official info", () => {
    const prompt = buildSystemPrompt({ examType: "KPSS", daysRemaining: 90, examDateLabel: null });
    expect(prompt).toMatch(/Resmî bilgi ÜRETME/);
    expect(prompt).toContain("/bilgi");
    expect(prompt).toContain("KPSS");
  });

  it("free user is blocked (403, no AI on free)", async () => {
    expect((await chat(freeToken)).status).toBe(403);
  });

  it("premium user gets a reply and a usage row is metered", async () => {
    const res = await chat(premiumToken);
    expect(res.status).toBe(201);
    expect(typeof res.body.reply).toBe("string");
    expect(res.body.reply.length).toBeGreaterThan(0);
    expect(res.body.model).toBe("fake");
    expect(await aiUsageCount(premiumId)).toBeGreaterThan(0);
  });

  it("ai.enabled=false → 404 (global kill-switch)", async () => {
    await setConfig("ai.enabled", false);
    expect((await chat(premiumToken)).status).toBe(404);
    await setConfig("ai.enabled", true); // restore
  });

  it("daily rate-limit → 429 after the cap", async () => {
    const rl = await signup("rl");
    await grantRole(rl.user.id, UserRole.STAFF);
    const rlToken = await login(rl.email);
    await setConfig("ai.chat.daily_limit", 1);
    try {
      expect((await chat(rlToken)).status).toBe(201);
      expect((await chat(rlToken)).status).toBe(429);
    } finally {
      await setConfig("ai.chat.daily_limit", 30); // restore
    }
  });
});
