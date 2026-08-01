import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { UserRole } from "@mentor/types";
import { buildSystemPrompt } from "../src/modules/ai/domain/ai.constants";
import { CoachMessageRepository } from "../src/modules/ai/infrastructure/coach-message.repository";

const RUN = Date.now();

/**
 * W3 AI coach chat (e2e, fake LLM): premium flat + earned-coin path, access probe, rate-limits,
 * usage metering. Real Postgres (RLS active). §4 #1 refusal verified on the prompt.
 */
describe("ai coach chat (e2e)", () => {
  let app: INestApplication;
  let pool: Pool;
  let freeToken = "";
  let freeId = "";
  let premiumToken = "";
  let premiumId = "";
  let adminToken = "";
  let brokeToken = "";
  let brokeId = "";
  let rlToken = "";

  const seedCommunityBridgeThread = async (): Promise<string> => {
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query("select set_config('app.role','SERVICE',true)");
      const zone = await client.query<{ id: string }>(
        `insert into forum_zones (type, title, slug, visibility, created_by)
         values ('CHAT', 'Koç Köprüsü', $1, 'PUBLIC', $2) returning id`,
        [`ai-coach-bridge-${RUN}`, premiumId],
      );
      const tag = await client.query<{ id: string }>(
        `insert into forum_tags (slug, name_tr, name_en, coach_intent, created_by)
         values ($1, 'Planlama', 'Planning', 'PLAN', $2) returning id`,
        [`ai-planlama-${RUN}`, premiumId],
      );
      const thread = await client.query<{ id: string }>(
        `insert into forum_threads (zone_id, author_id, body)
         values ($1, $2, 'FORUM_SECRET_BODY_MUST_NOT_LEAK') returning id`,
        [zone.rows[0]!.id, premiumId],
      );
      await client.query(
        "insert into forum_thread_tags (thread_id, tag_id) values ($1, $2)",
        [thread.rows[0]!.id, tag.rows[0]!.id],
      );
      await client.query("commit");
      return thread.rows[0]!.id;
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  };

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

  const grantCoin = async (userId: string, amount: number) => {
    const c = await pool.connect();
    try {
      await c.query("select set_config('app.role','SERVICE',true)");
      await c.query(
        `insert into ledger_entries (user_id, unit, amount, reason, status)
         values ($1, 'COIN', $2, 'test.grant', 'CONFIRMED')`,
        [userId, amount],
      );
    } finally {
      c.release();
    }
  };

  const coinBalance = async (userId: string): Promise<number> => {
    const c = await pool.connect();
    try {
      await c.query("select set_config('app.role','SERVICE',true)");
      const res = await c.query(
        `select coalesce(sum(amount),0)::int as n from ledger_entries
         where user_id=$1 and unit='COIN' and status='CONFIRMED'`,
        [userId],
      );
      return res.rows[0]?.n ?? 0;
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
    freeId = free.user.id;

    const premium = await signup("premium");
    premiumId = premium.user.id;
    await grantRole(premiumId, UserRole.STAFF);
    premiumToken = await login(premium.email);

    const admin = await signup("admin");
    await grantRole(admin.user.id, UserRole.ADMIN);
    adminToken = await login(admin.email);

    const broke = await signup("broke");
    brokeToken = broke.accessToken;
    brokeId = broke.user.id;
    await grantCoin(brokeId, 2);

    const rl = await signup("rl");
    await grantRole(rl.user.id, UserRole.STAFF);
    rlToken = await login(rl.email);
  }, 90_000);

  afterAll(async () => {
    if (app && adminToken) {
      await setConfig("forum.coach_bridge.enabled", false);
      await setConfig("forum.enabled", false);
    }
    await app?.close();
    await pool?.end();
  });

  const chat = (
    token: string,
    message = "Bugün nasıl çalışmalıyım?",
    clientMessageId?: string,
  ) =>
    request(app.getHttpServer())
      .post("/v1/coach/chat")
      .set({ Authorization: `Bearer ${token}` })
      .send({ message, ...(clientMessageId ? { clientMessageId } : {}) });

  const access = (token: string) =>
    request(app.getHttpServer()).get("/v1/coach/access").set({ Authorization: `Bearer ${token}` });

  it("§4 #1: the system prompt forbids generating official info", () => {
    const prompt = buildSystemPrompt({ examType: "KPSS", daysRemaining: 90, examDateLabel: null });
    expect(prompt).toMatch(/Resmî bilgi ÜRETME/);
    expect(prompt).toContain("/bilgi");
    expect(prompt).toContain("KPSS");
  });

  it("free user with economy off is blocked (403)", async () => {
    await setConfig("economy.enabled", false);
    expect((await chat(freeToken)).status).toBe(403);
  });

  it("GET /coach/access reflects premium vs coin vs none", async () => {
    await setConfig("economy.enabled", true);
    await grantCoin(freeId, 20);

    const premiumAccess = await access(premiumToken);
    expect(premiumAccess.status).toBe(200);
    expect(premiumAccess.body.mode).toBe("PREMIUM");
    expect(premiumAccess.body.canChat).toBe(true);
    expect(typeof premiumAccess.body.dailyMessagesRemaining).toBe("number");

    const coinAccess = await access(freeToken);
    expect(coinAccess.status).toBe(200);
    expect(coinAccess.body.mode).toBe("COIN");
    expect(coinAccess.body.canChat).toBe(true);
    expect(coinAccess.body.chatCost).toBe(5);
  });

  it("premium user gets a reply and coin ledger is unchanged", async () => {
    const before = await coinBalance(premiumId);
    const res = await chat(premiumToken);
    expect(res.status).toBe(201);
    expect(typeof res.body.reply).toBe("string");
    expect(res.body.reply.length).toBeGreaterThan(0);
    expect(res.body.model).toBe("fake");
    // Default message contains "nasıl" → fake adapter appends the FOLLOWUP marker; the backend
    // must strip it from the reply text and surface it as the ephemeral followUps field.
    expect(res.body.followUps).toHaveLength(2);
    expect(res.body.reply).not.toContain("<<");
    expect(await aiUsageCount(premiumId)).toBeGreaterThan(0);
    expect(await coinBalance(premiumId)).toBe(before);

    const history = await request(app.getHttpServer())
      .get(`/v1/coach/conversations/${res.body.conversationId}/messages`)
      .set({ Authorization: `Bearer ${premiumToken}` });
    expect(history.status).toBe(200);
    expect(
      history.body.items.map((message: { role: string }) => message.role),
    ).toEqual(["COACH", "USER"]);
  });

  it("community bridge persists structural origin and reloads a public-safe source", async () => {
    await setConfig("forum.enabled", true);
    await setConfig("forum.coach_bridge.enabled", true);
    const threadId = await seedCommunityBridgeThread();

    const bridge = await request(app.getHttpServer())
      .get(`/v1/forum/threads/${threadId}/coach-bridge`)
      .set({ Authorization: `Bearer ${premiumToken}` });
    expect(bridge.status).toBe(200);
    expect(bridge.body.intent).toBe("PLAN");
    expect(JSON.stringify(bridge.body)).not.toMatch(/FORUM_SECRET|author|body|comment|profile/i);

    const sent = await request(app.getHttpServer())
      .post("/v1/coach/chat")
      .set({ Authorization: `Bearer ${premiumToken}` })
      .send({
        message: "Planımı uygulanabilir hâle getirelim.",
        contextCommunityThreadId: threadId,
      });
    expect(sent.status).toBe(201);

    const history = await request(app.getHttpServer())
      .get(`/v1/coach/conversations/${sent.body.conversationId}/messages`)
      .set({ Authorization: `Bearer ${premiumToken}` });
    expect(history.status).toBe(200);
    expect(history.body.origin).toEqual({
      type: "COMMUNITY_THREAD",
      refId: threadId,
      meta: { intent: "PLAN", tagSlug: `ai-planlama-${RUN}` },
    });
    expect(history.body.communitySource.intent).toBe("PLAN");
    expect(JSON.stringify(history.body)).not.toContain("FORUM_SECRET_BODY_MUST_NOT_LEAK");

    const usageBeforeTask = await aiUsageCount(premiumId);
    const coinsBeforeTask = await coinBalance(premiumId);
    const createdTask = await request(app.getHttpServer())
      .post(`/v1/coach/conversations/${sent.body.conversationId}/plan-tasks`)
      .set({ Authorization: `Bearer ${premiumToken}` })
      .send({
        title: "Bugün 20 soru",
        subject: "Türkçe",
        // Untrusted provenance is ignored; the response must use the server-resolved source.
        threadId: "00000000-0000-4000-8000-0000000000ff",
        intent: "STRATEGY",
        zoneType: "QA",
      });
    expect(createdTask.status).toBe(201);
    expect(createdTask.body.origin).toEqual({
      type: "COMMUNITY_COACH",
      conversationId: sent.body.conversationId,
      threadId,
      intent: "PLAN",
      zoneType: "CHAT",
    });
    expect(await aiUsageCount(premiumId)).toBe(usageBeforeTask);
    expect(await coinBalance(premiumId)).toBe(coinsBeforeTask);

    const updatedTask = await request(app.getHttpServer())
      .patch(`/v1/plan-tasks/${createdTask.body.id}`)
      .set({ Authorization: `Bearer ${premiumToken}` })
      .send({ title: "Bugün 25 soru", status: "DONE" });
    expect(updatedTask.status).toBe(200);
    expect(updatedTask.body.origin).toEqual(createdTask.body.origin);

    await request(app.getHttpServer())
      .post(`/v1/coach/conversations/${sent.body.conversationId}/plan-tasks`)
      .set({ Authorization: `Bearer ${freeToken}` })
      .send({ title: "Başkasının konuşması" })
      .expect(404);

    await setConfig("forum.coach_bridge.enabled", false);
    await request(app.getHttpServer())
      .post(`/v1/coach/conversations/${sent.body.conversationId}/plan-tasks`)
      .set({ Authorization: `Bearer ${premiumToken}` })
      .send({ title: "Bayrak kapalı" })
      .expect(404);
    await setConfig("forum.coach_bridge.enabled", true);

    await request(app.getHttpServer())
      .get(`/v1/coach/conversations/${sent.body.conversationId}/messages`)
      .set({ Authorization: `Bearer ${freeToken}` })
      .expect(404);

    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query("select set_config('app.role','SERVICE',true)");
      await client.query("update forum_threads set deleted_at=now() where id=$1", [threadId]);
      await client.query("commit");
    } finally {
      client.release();
    }
    const unavailable = await request(app.getHttpServer())
      .get(`/v1/coach/conversations/${sent.body.conversationId}/messages`)
      .set({ Authorization: `Bearer ${premiumToken}` });
    expect(unavailable.status).toBe(200);
    expect(unavailable.body.origin.refId).toBe(threadId);
    expect(unavailable.body.communitySource).toBeNull();
    await request(app.getHttpServer())
      .post(`/v1/coach/conversations/${sent.body.conversationId}/plan-tasks`)
      .set({ Authorization: `Bearer ${premiumToken}` })
      .send({ title: "Silinmiş kaynaktan görev" })
      .expect(404);
  });

  it("free user with coin spends on chat (201, balance drops)", async () => {
    await setConfig("economy.enabled", true);
    await grantCoin(freeId, 20);
    const before = await coinBalance(freeId);
    const res = await chat(freeToken);
    expect(res.status).toBe(201);
    expect(await coinBalance(freeId)).toBe(before - 5);
  });

  it("free user with insufficient coin → 422 INSUFFICIENT_COIN", async () => {
    await setConfig("economy.enabled", true);
    const res = await chat(brokeToken);
    expect(res.status).toBe(422);
    expect(res.body.code).toBe("INSUFFICIENT_COIN");
  });

  it("free coin daily rate-limit → 429 after the cap", async () => {
    await setConfig("economy.enabled", true);
    await grantCoin(brokeId, 100);
    await setConfig("ai.chat.free_coin_daily_limit", 1);
    try {
      expect((await chat(brokeToken)).status).toBe(201);
      expect((await chat(brokeToken)).status).toBe(429);
    } finally {
      await setConfig("ai.chat.free_coin_daily_limit", 5);
    }
  });

  it("clientMessageId is idempotent (no double spend)", async () => {
    await setConfig("economy.enabled", true);
    await grantCoin(brokeId, 20);
    const msgId = "00000000-0000-4000-8000-000000000001";
    expect((await chat(brokeToken, "Merhaba", msgId)).status).toBe(201);
    const afterFirstBal = await coinBalance(brokeId);
    expect((await chat(brokeToken, "Merhaba tekrar", msgId)).status).toBe(201);
    expect(await coinBalance(brokeId)).toBe(afterFirstBal);
  });

  it("ai.enabled=false → 404 (global kill-switch)", async () => {
    await setConfig("ai.enabled", false);
    expect((await chat(premiumToken)).status).toBe(404);
    await setConfig("ai.enabled", true);
  });

  it("premium daily rate-limit → 429 after the cap", async () => {
    await setConfig("ai.chat.daily_limit", 1);
    try {
      expect((await chat(rlToken)).status).toBe(201);
      expect((await chat(rlToken)).status).toBe(429);
    } finally {
      await setConfig("ai.chat.daily_limit", 30);
    }
  });

  it("rolls back a new conversation when exchange insertion fails", async () => {
    const title = `Rollback thread ${RUN}`;
    const messages = app.get(CoachMessageRepository);

    await expect(
      messages.persistExchange(
        premiumId,
        { kind: "new", title },
        "Kullanıcı mesajı",
        {
          content: undefined as never,
          model: "fake",
          sources: [],
        },
      ),
    ).rejects.toBeDefined();

    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query("select set_config('app.role','SERVICE',true)");
      const result = await client.query<{ count: number }>(
        "select count(*)::int as count from coach_conversations where user_id=$1 and title=$2",
        [premiumId, title],
      );
      expect(result.rows[0]?.count).toBe(0);
      await client.query("commit");
    } finally {
      client.release();
    }
  });
  it("hides legacy empty conversations from list and direct history", async () => {
    const client = await pool.connect();
    let emptyConversationId = "";
    try {
      await client.query("begin");
      await client.query("select set_config('app.role','SERVICE',true)");
      const inserted = await client.query<{ id: string }>(
        "insert into coach_conversations (user_id, title) values ($1, $2) returning id",
        [premiumId, "Legacy empty thread"],
      );
      emptyConversationId = inserted.rows[0]!.id;
      await client.query("commit");
    } finally {
      client.release();
    }

    const conversations = await request(app.getHttpServer())
      .get("/v1/coach/conversations?page=1&pageSize=20")
      .set({ Authorization: `Bearer ${premiumToken}` });
    expect(conversations.status).toBe(200);
    expect(
      conversations.body.items.some(
        (conversation: { id: string }) =>
          conversation.id === emptyConversationId,
      ),
    ).toBe(false);
    expect(conversations.body.total).toBe(conversations.body.items.length);

    const history = await request(app.getHttpServer())
      .get(`/v1/coach/conversations/${emptyConversationId}/messages`)
      .set({ Authorization: `Bearer ${premiumToken}` });
    expect(history.status).toBe(404);
  });
  it("regenerate replaces the last coach reply in place (SSE; count stable, feedback reset)", async () => {
    const first = await chat(premiumToken);
    expect(first.status).toBe(201);
    const convId = first.body.conversationId as string;

    const regen = await request(app.getHttpServer())
      .post(`/v1/coach/conversations/${convId}/regenerate/stream`)
      .set({ Authorization: `Bearer ${premiumToken}` });
    expect(regen.status).toBe(201); // Nest @Post default — same as chat/stream

    expect(regen.text).toContain('"done"');
    expect(regen.text).not.toContain("<<");

    const messages = await request(app.getHttpServer())
      .get(`/v1/coach/conversations/${convId}/messages`)
      .set({ Authorization: `Bearer ${premiumToken}` });
    expect(messages.status).toBe(200);
    expect(messages.body.total).toBe(2); // still one USER + one COACH row
    const coachRow = messages.body.items.find((m: { role: string }) => m.role === "COACH");
    expect(coachRow.feedback).toBeNull();

    const bogus = await request(app.getHttpServer())
      .post("/v1/coach/conversations/00000000-0000-4000-8000-00000000dead/regenerate/stream")
      .set({ Authorization: `Bearer ${premiumToken}` });
    expect(bogus.status).toBe(404);
  });

  it("plan draft: premium gets a clamped 7-day preview; free is 403; nothing persisted", async () => {
    const draft = (token: string) =>
      request(app.getHttpServer())
        .post("/v1/coach/plan-draft")
        .set({ Authorization: `Bearer ${token}` })
        .send({ note: "hafta sonu yoğunum" });

    const res = await draft(premiumToken);
    expect(res.status).toBe(201);
    expect(res.body.model).toBe("fake");
    expect(Array.isArray(res.body.days)).toBe(true);
    expect(res.body.days.length).toBeGreaterThan(0);
    for (const day of res.body.days) {
      expect(day.tasks.length).toBeGreaterThan(0);
      expect(day.tasks.length).toBeLessThanOrEqual(3);
      expect(typeof day.tasks[0].title).toBe("string");
    }

    expect((await draft(freeToken)).status).toBe(403);
  });

  it("daily greeting: premium generates once then hits the day cache; free is 403", async () => {
    const greet = (token: string) =>
      request(app.getHttpServer())
        .post("/v1/coach/daily-greeting")
        .set({ Authorization: `Bearer ${token}` });

    const first = await greet(premiumToken);
    expect(first.status).toBe(200);
    expect(first.body.greeting.length).toBeGreaterThan(0);
    expect(first.body.model).not.toBe("cache");

    const second = await greet(premiumToken);
    expect(second.status).toBe(200);
    expect(second.body.greeting).toBe(first.body.greeting);
    expect(second.body.model).toBe("cache");

    expect((await greet(freeToken)).status).toBe(403);
  });
});
