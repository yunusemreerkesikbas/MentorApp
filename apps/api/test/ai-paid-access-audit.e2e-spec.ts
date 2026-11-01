import { randomUUID } from "node:crypto";
import { Currency } from "@mentor/types";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { LLM_PORT, type LlmPort } from "../src/modules/ai/domain/llm.port";
import request from "./browser-request";
import { economyAuditHarness } from "./fixtures/economy-audit";
import { weeklyAccount } from "./fixtures/weekly-analysis";

describe("Paid student AI access inventory (HTTP/Postgres)", () => {
  let h: Awaited<ReturnType<typeof economyAuditHarness>>;
  let user: Awaited<ReturnType<typeof h.signup>>;
  const headers = () => ({ Authorization: `Bearer ${user.token}` });
  const post = (path: string, body = {}) =>
    request(h.app.getHttpServer())
      .post(`/v1/${path}`)
      .set(headers())
      .send(body);
  const get = (path: string) =>
    request(h.app.getHttpServer()).get(`/v1/${path}`).set(headers());
  const balance = () => h.economy.getAdminBalance(user.id);
  beforeAll(async () => {
    h = await economyAuditHarness();
  }, 90_000);
  beforeEach(async () => {
    vi.restoreAllMocks();
    await h.set("economy.enabled", true);
    await h.set("ai.enabled", true);
    await h.set("ai.budget.monthly_cap_usd_cents", 0);
    await h.set("economy.coin.ai_chat_cost", 5);
    await h.set("ai.chat.free_coin_daily_limit", 5);
    for (const key of [
      "ai.features.plan.ai.free_enabled",
      "ai.features.daily.greeting.free_enabled",
      "ai.features.mood.reflection.free_enabled",
      "ai.features.session.reflection.free_enabled",
      "ai.features.ghost.narration.free_enabled",
      "ai.features.vision.note.free_enabled",
      "ai.features.photo.categorize.free_enabled",
      "ai.features.coach.chat.free_enabled",
    ] as const) {
      await h.set(key, false);
    }
    user = await h.signup();
    await h.economy.grant(user.id, Currency.COIN, 100, {
      reason: "qa.access.inventory",
      enforceLimits: false,
    });
  });
  afterAll(async () => {
    vi.restoreAllMocks();
    await h?.app.close();
    await h?.pool.end();
  });

  it("a Coin-rich Free account cannot buy the other AI surfaces implicitly", async () => {
    const complete = vi.spyOn(h.app.get<LlmPort>(LLM_PORT), "complete");
    const before = await balance();
    for (const [path, body] of [
      ["coach/plan-draft", {}],
      ["coach/plan-adaptation", { source: "PLAN" }],
      ["coach/daily-greeting", {}],
      ["coach/mood-reflection", {}],
      ["coach/session-reflection", { sessionId: randomUUID() }],
      ["coach/ghost-narration", { examId: randomUUID() }],
      ["coach/vision-note", {}],
    ] as const) {
      const res = await post(path, body);
      expect(res.status, path).toBe(403);
      expect(res.body.code).toBe("PAYMENT_PREMIUM_REQUIRED");
    }
    expect((await get("coach/plan-adaptation/brief")).status).toBe(403);
    expect((await get("coach/photo-access")).body).toMatchObject({
      canCategorize: false,
      reason: "PAYMENT_PREMIUM_REQUIRED",
    });
    expect(await balance()).toEqual(before);
    expect(complete).not.toHaveBeenCalled();
  });

  it("chat has a distinct Coin access path and merely opening it does not debit", async () => {
    const before = await balance();
    expect((await get("coach/access")).body).toMatchObject({
      canChat: true,
      mode: "COIN",
      chatCost: 5,
      freeCoinMessagesRemainingToday: 5,
    });
    expect(await balance()).toEqual(before);
    await h.set("economy.enabled", false);
    expect((await get("coach/access")).body).toMatchObject({
      canChat: false,
      mode: "NONE",
      reason: "PAYMENT_PREMIUM_REQUIRED",
    });
    expect(await balance()).toEqual(before);
  });

  it("a capped plan taste uses its own allowance, not the Coin balance", async () => {
    await h.set("ai.features.plan.ai.free_enabled", true);
    await h.set("ai.features.plan.ai.free_limit", 1);
    const before = await balance();
    expect((await post("coach/plan-draft")).status).toBe(201);
    // Draft and adaptation share the plan.ai usage window.
    expect(
      (await post("coach/plan-adaptation", { source: "PLAN" })).body.code,
    ).toBe("PAYMENT_PREMIUM_REQUIRED");
    expect((await post("coach/plan-draft")).body.code).toBe(
      "PAYMENT_PREMIUM_REQUIRED",
    );
    expect(await balance()).toEqual(before);
  });

  it("lets a used Free greeting taste reread its stored note without another allowance or Coin", async () => {
    await h.set("ai.features.daily.greeting.free_enabled", true);
    await h.set("ai.features.daily.greeting.free_limit", 1);
    const before = await balance();
    expect((await post("coach/daily-greeting")).status).toBe(200);
    const second = await post("coach/daily-greeting");
    expect(second.status).toBe(200);
    expect(second.body.model).toBe("cache");
    const otherLocale = await request(h.app.getHttpServer())
      .post("/v1/coach/daily-greeting")
      .set({ ...headers(), "Accept-Language": "en" })
      .send({});
    expect(otherLocale.status).toBe(403);
    expect(await balance()).toEqual(before);
  });

  it("Premium includes plan and cached greeting independently of economy, without Coin spending", async () => {
    user = await weeklyAccount(h.app, h.pool, true);
    await h.set("economy.enabled", false);
    const before = await balance();
    expect((await post("coach/plan-draft")).status).toBe(201);
    expect((await post("coach/daily-greeting")).status).toBe(200);
    expect((await post("coach/daily-greeting")).body.model).toBe("cache");
    expect(await balance()).toEqual(before);
    await h.set("ai.enabled", false);
    expect((await post("coach/daily-greeting")).body.code).toBe("AI_DISABLED");
    expect((await post("coach/plan-draft")).body.code).toBe("AI_DISABLED");
  });
});
