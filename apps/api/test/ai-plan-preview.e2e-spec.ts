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
import { AiUsageRepository } from "../src/modules/ai/infrastructure/ai-usage.repository";
import { PlanAdaptationService } from "../src/modules/ai/application/plan-adaptation.service";
import { weeklyAccount } from "./fixtures/weekly-analysis";
import { AiErasureService } from "../src/modules/ai/application/ai-erasure.service";

describe("Coin plan previews (HTTP/Postgres)", () => {
  let h: Awaited<ReturnType<typeof economyAuditHarness>>;
  let user: { id: string; token: string };
  const headers = () => ({ Authorization: `Bearer ${user.token}` });
  const input = { source: "PLAN", days: 3, minutesPerDay: 120 };
  const post = (
    clientRequestId = randomUUID(),
    expectedCost = 20,
    plan = input,
  ) =>
    request(h.app.getHttpServer())
      .post("/v1/coach/plan-previews")
      .set({ ...headers(), "Idempotency-Key": clientRequestId })
      .send({ input: plan, expectedCost, clientRequestId });
  const get = (path = "access") =>
    request(h.app.getHttpServer())
      .get(`/v1/coach/plan-previews/${path}`)
      .set(headers());
  const coins = async () =>
    (await h.economy.getAdminBalance(user.id)).coinConfirmed;
  beforeAll(async () => {
    h = await economyAuditHarness();
  }, 90_000);
  beforeEach(async () => {
    vi.restoreAllMocks();
    for (const [key, value] of [
      ["economy.enabled", true],
      ["ai.enabled", true],
      ["ai.plan.coin_enabled", true],
      ["ai.features.plan.ai.free_enabled", false],
      ["ai.budget.monthly_cap_usd_cents", 0],
      ["economy.coin.plan_preview_cost", 20],
      ["ai.plan.coin_daily_limit", 1],
      ["ai.plan_draft.daily_limit", 5],
    ] as const)
      await h.set(key, value);
    user = await h.signup();
    await h.economy.grant(user.id, Currency.COIN, 100, {
      reason: "qa.plan.preview",
      enforceLimits: false,
    });
  });
  afterAll(async () => {
    vi.restoreAllMocks();
    await h?.app.close();
    await h?.pool.end();
  });

  it("saves one paid preview and replays/reads it without another model call or debit", async () => {
    const complete = vi.spyOn(h.app.get<LlmPort>(LLM_PORT), "complete");
    const id = randomUUID();
    const first = await post(id);
    expect(first.status).toBe(201);
    expect(first.body.coinSpent).toBe(20);
    expect(first.body.preview.status).toBe("READY");
    expect(first.body.preview.changes.length).toBeGreaterThan(0);
    expect(await coins()).toBe(80);
    const catalog = await request(h.app.getHttpServer())
      .get("/v1/economy/uses")
      .set(headers());
    expect(
      catalog.body.items.find(
        (item: { id: string }) => item.id === "PLAN_PREVIEW",
      ),
    ).toMatchObject({
      status: "ALREADY_UNLOCKED",
      canOpen: true,
      dailyRemaining: 0,
    });
    expect((await post(id)).body).toEqual(first.body);
    expect((await get(id)).body).toEqual(first.body);
    expect(complete).toHaveBeenCalledOnce();
    expect(await coins()).toBe(80);
    const used = (await get()).body;
    expect(used).toMatchObject({
      canGenerate: false,
      dailyRemaining: 0,
      latestRequestId: id,
    });
    // The next Coin draft arrives when this one leaves the rolling 24 hours.
    const wait = Date.parse(used.nextAvailableAt) - Date.now();
    expect(wait).toBeGreaterThan(23 * 3_600_000);
    expect(wait).toBeLessThanOrEqual(24 * 3_600_000);
    await h.set("economy.enabled", false);
    await h.set("ai.plan.coin_enabled", false);
    expect((await get(id)).body).toEqual(first.body);
    expect((await post()).status).toBe(404);
  });

  it("rejects stale prices before spending or generating", async () => {
    const complete = vi.spyOn(h.app.get<LlmPort>(LLM_PORT), "complete");
    expect((await post(randomUUID(), 10)).status).toBe(409);
    expect(complete).not.toHaveBeenCalled();
    expect(await coins()).toBe(100);
  });

  it("requires the matching idempotency header on Coin POSTs", async () => {
    const denied = await request(h.app.getHttpServer())
      .post("/v1/coach/plan-previews")
      .set(headers())
      .send({ input, expectedCost: 20, clientRequestId: randomUUID() });
    expect(denied.status).toBe(400);
    expect(await coins()).toBe(100);
  });

  it("deduplicates concurrent retries with the same id", async () => {
    const complete = vi.spyOn(h.app.get<LlmPort>(LLM_PORT), "complete");
    const id = randomUUID();
    const results = await Promise.all([post(id), post(id)]);
    expect(results.some((r) => r.status === 201)).toBe(true);
    expect(results.every((r) => r.status === 201 || r.status === 409)).toBe(
      true,
    );
    expect(complete).toHaveBeenCalledOnce();
    expect(await coins()).toBe(80);
  });

  it("expires an abandoned unpaid claim and uses a rolling 24-hour allowance", async () => {
    await h.tx(async (client) => {
      await client.query(
        "insert into ai_plan_previews(user_id,client_request_id,input_hash,locale,status,cost,created_at) values ($1,$2,'qa','tr','RUNNING',20,now()-interval '6 minutes')",
        [user.id, randomUUID()],
      );
    });
    expect((await get()).body).toMatchObject({ dailyRemaining: 1, nextAvailableAt: null });
    expect((await post()).status).toBe(201);
    await h.tx(async (client) => {
      await client.query(
        "update ai_plan_previews set created_at=now()-interval '25 hours' where user_id=$1",
        [user.id],
      );
    });
    expect((await get()).body.dailyRemaining).toBe(1);
    expect((await post()).status).toBe(201);
    expect(await coins()).toBe(60);
  });

  it("erases private saved previews while retaining the append-only Coin ledger", async () => {
    const id = randomUUID();
    expect((await post(id)).status).toBe(201);
    await h.app.get(AiErasureService).eraseUserData(user.id);
    expect((await get(id)).status).toBe(404);
    expect(await coins()).toBe(80);
  });

  it("enforces the rolling allowance across concurrent different requests", async () => {
    const complete = vi.spyOn(h.app.get<LlmPort>(LLM_PORT), "complete");
    const results = await Promise.all([post(), post()]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 429]);
    expect(complete).toHaveBeenCalledOnce();
    expect(await coins()).toBe(80);
  });

  it("keeps failed generation free and does not implicitly rerun a failed request", async () => {
    const complete = vi
      .spyOn(h.app.get<LlmPort>(LLM_PORT), "complete")
      .mockRejectedValueOnce(new Error("provider unavailable"));
    const id = randomUUID();
    expect((await post(id)).status).toBe(503);
    expect((await post(id)).status).toBe(503);
    expect(complete).toHaveBeenCalledOnce();
    expect(await coins()).toBe(100);
    expect((await get()).body.canGenerate).toBe(true);
  });

  it("rejects foreign reads and binds reused request ids to the original input", async () => {
    const id = randomUUID();
    expect((await post(id)).status).toBe(201);
    expect((await post(id, 20, { ...input, days: 4 })).status).toBe(409);
    const other = await h.signup();
    const foreign = await request(h.app.getHttpServer())
      .get(`/v1/coach/plan-previews/${id}`)
      .set({ Authorization: `Bearer ${other.token}` });
    expect(foreign.status).toBe(404);
  });

  it("uses dynamic admin prices and limits", async () => {
    expect((await post()).status).toBe(201);
    await h.set("ai.plan.coin_daily_limit", 2);
    await h.set("economy.coin.plan_preview_cost", 10);
    expect((await get()).body).toMatchObject({
      cost: 10,
      dailyLimit: 2,
      dailyRemaining: 1,
    });
    expect((await post(randomUUID(), 10)).status).toBe(201);
    expect(await coins()).toBe(70);
  });

  it("does not charge or call the provider when funds or global budget are unavailable", async () => {
    const complete = vi.spyOn(h.app.get<LlmPort>(LLM_PORT), "complete");
    await h.set("economy.coin.plan_preview_cost", 101);
    expect((await post(randomUUID(), 101)).body.code).toBe("INSUFFICIENT_COIN");
    await h.set("economy.coin.plan_preview_cost", 20);
    await h.app.get(AiUsageRepository).append({
      userId: user.id,
      model: "qa",
      feature: "qa",
      promptTokens: 0,
      completionTokens: 0,
      costMicros: 20000,
    });
    await h.set("ai.budget.monthly_cap_usd_cents", 1);
    expect((await get()).body).toMatchObject({
      canGenerate: false,
      reason: "AI_BUDGET_EXCEEDED",
    });
    expect((await post()).status).toBe(503);
    expect(complete).not.toHaveBeenCalled();
    expect(await coins()).toBe(100);
  });

  it("keeps a generated result recoverable if another purchase uses the balance during generation", async () => {
    const llm = h.app.get<LlmPort>(LLM_PORT);
    const original = llm.complete.bind(llm);
    const complete = vi
      .spyOn(llm, "complete")
      .mockImplementationOnce(async (input) => {
        const result = await original(input);
        await h.economy.spend(user.id, 100, {
          reason: "qa.other.purchase",
          refType: "qa",
          refId: randomUUID(),
        });
        return result;
      });
    const id = randomUUID();
    expect((await post(id)).body.code).toBe("INSUFFICIENT_COIN");
    expect((await get(id)).body).toMatchObject({
      state: "GENERATED",
      preview: null,
      coinSpent: 0,
    });
    await h.set("economy.enabled", false);
    expect((await get(id)).status).toBe(404);
    expect((await get()).body.latestRequestId).toBeNull();
    await h.set("economy.enabled", true);
    await h.economy.grant(user.id, Currency.COIN, 20, {
      reason: "qa.funds",
      enforceLimits: false,
    });
    const settled = await request(h.app.getHttpServer())
      .post(`/v1/coach/plan-previews/${id}/confirm`)
      .set({ ...headers(), "Idempotency-Key": id })
      .send({ expectedCost: 20 });
    expect(settled.status).toBe(201);
    expect(settled.body).toMatchObject({ state: "READY", coinSpent: 20 });
    expect((await post(id)).body).toEqual(settled.body);
    expect(complete).toHaveBeenCalledOnce();
    expect(await coins()).toBe(0);
  });

  it("does not spend for malformed output or a no-change result", async () => {
    vi.spyOn(h.app.get<LlmPort>(LLM_PORT), "complete").mockResolvedValueOnce({
      text: "invalid",
      model: "fake",
      promptTokens: 1,
      completionTokens: 1,
    });
    expect((await post()).status).toBe(503);
    expect(await coins()).toBe(100);
    vi.spyOn(h.app.get(PlanAdaptationService), "preview").mockResolvedValueOnce(
      {
        status: "NO_CHANGE",
        message: "Planın hazır.",
        model: "rules",
        groundingLine: null,
        changes: [],
        planRevision: "qa",
        window: { from: "2026-11-01", to: "2026-11-07" },
      },
    );
    const result = await post();
    expect(result.status).toBe(201);
    expect(result.body.coinSpent).toBe(0);
    expect(await coins()).toBe(100);
    expect((await get()).body.dailyRemaining).toBe(1);
  });

  it("keeps Premium and capped Free generation included rather than selling an unnecessary Coin right", async () => {
    user = await weeklyAccount(h.app, h.pool, true);
    expect((await get()).body).toMatchObject({ mode: "INCLUDED", cost: null });
    expect((await post()).status).toBe(409);
    expect(await coins()).toBe(0);
    user = await h.signup();
    await h.set("ai.features.plan.ai.free_enabled", true);
    await h.set("ai.features.plan.ai.free_limit", 1);
    expect((await get()).body).toMatchObject({ mode: "INCLUDED", cost: null });
    expect((await post()).status).toBe(409);
  });

  it("closes new Coin requests when either switch is off and preserves other adaptation gates", async () => {
    await h.set("ai.plan.coin_enabled", false);
    expect((await post()).status).toBe(404);
    await h.set("ai.plan.coin_enabled", true);
    await h.set("ai.enabled", false);
    expect((await post()).body.code).toBe("AI_DISABLED");
    await h.set("ai.enabled", true);
    expect(
      (await post(randomUUID(), 20, { source: "MOOD" } as typeof input)).status,
    ).toBe(400);
    const mood = await request(h.app.getHttpServer())
      .post("/v1/coach/plan-adaptation")
      .set(headers())
      .send({ source: "MOOD" });
    expect(mood.status).toBe(403);
  });
});
