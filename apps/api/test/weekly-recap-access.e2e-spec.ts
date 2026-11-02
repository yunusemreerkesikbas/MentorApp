import { randomUUID } from "node:crypto";
import { Currency, type WeeklyRecapOfferDto } from "@mentor/types";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { economyAuditHarness } from "./fixtures/economy-audit";
import { weeklyAccount } from "./fixtures/weekly-analysis";
import { weeklyReviewWindows } from "../src/modules/coaching/domain/weekly-review";
import { LLM_PORT, type LlmPort } from "../src/modules/ai/domain/llm.port";
import { AiErasureService } from "../src/modules/ai/application/ai-erasure.service";
import { WeeklyReviewCacheRepository } from "../src/modules/ai/infrastructure/weekly-review-cache.repository";
import { AiUsageRepository } from "../src/modules/ai/infrastructure/ai-usage.repository";
import request from "./browser-request";

describe("Owned Wrapped reports (HTTP/Postgres)", () => {
  let h: Awaited<ReturnType<typeof economyAuditHarness>>;
  let user: { id: string; token: string };
  let exams: string[];
  const headers = () => ({ Authorization: `Bearer ${user.token}` });
  const offer = async (examId = exams[0]!) => (await request(h.app.getHttpServer())
    .get(`/v1/coach/weekly-recaps/access?examId=${examId}`).set(headers())).body as WeeklyRecapOfferDto;
  const open = async (view?: WeeklyRecapOfferDto, cost?: number, id = randomUUID()) => {
    const state = view ?? await offer();
    return request(h.app.getHttpServer()).post("/v1/coach/weekly-recaps")
      .set({ ...headers(), "Idempotency-Key": id }).send({ examId: state.examId, weekStart: state.weekStart,
        source: state.mode, expectedCost: cost ?? state.cost, clientRequestId: id });
  };
  const coins = async () => (await h.economy.getAdminBalance(user.id)).coinConfirmed;
  const archive = () => request(h.app.getHttpServer()).get("/v1/coach/weekly-recaps").set(headers());
  beforeAll(async () => {
    h = await economyAuditHarness();
    exams = (await h.pool.query("select id from exams order by id limit 2")).rows.map((r: { id: string }) => r.id);
    expect(exams.length).toBe(2);
  }, 90_000);
  beforeEach(async () => {
    vi.restoreAllMocks();
    for (const [key, value] of [
      ["coaching.weekly_recap.access_enabled", true], ["coaching.weekly_recap.free_enabled", false],
      ["coaching.weekly_recap.free_limit", 1], ["coaching.weekly_recap.coin_enabled", true],
      ["coaching.weekly_recap.coin_limit", 2], ["coaching.weekly_recap.coin_window_days", 30],
      ["coaching.weekly_recap.ai_enabled", true], ["economy.enabled", true], ["ai.enabled", true],
      ["economy.coin.deep_analysis_cost", 25], ["ai.budget.monthly_cap_usd_cents", 0],
    ] as const) await h.set(key, value);
    user = await weeklyAccount(h.app, h.pool);
    await h.economy.grant(user.id, Currency.COIN, 100, { reason: "qa.wrapped", enforceLimits: false });
  });
  afterAll(async () => { vi.restoreAllMocks(); await h?.app.close(); await h?.pool.end(); });

  it("keeps offers side-effect-free and enforces direct story, narration and completion gates", async () => {
    const llm = vi.spyOn(h.app.get<LlmPort>(LLM_PORT), "complete");
    expect(await offer()).toMatchObject({ mode: "COIN", canOpen: true, cost: 25, coinRemaining: 2 });
    const story = await request(h.app.getHttpServer()).get(`/v1/coaching/weekly-review?examId=${exams[0]}`).set(headers());
    expect(story.status).toBe(403);
    const narration = await request(h.app.getHttpServer()).post("/v1/coach/weekly-review").set(headers()).send({ examId: exams[0] });
    expect(narration.status).toBe(403);
    const complete = await request(h.app.getHttpServer()).put("/v1/coaching/weekly-review/completion").set(headers())
      .send({ examId: exams[0], weekStart: weeklyReviewWindows().startDate });
    expect(complete.status).toBe(403);
    expect((await request(h.app.getHttpServer()).get(`/v1/coaching/analysis?examId=${exams[0]}`).set(headers())).status).toBe(200);
    expect((await archive()).body.total).toBe(0);
    expect(llm).not.toHaveBeenCalled(); expect(await coins()).toBe(100);
  });

  it("owns one immutable report and replays without a second debit or model call", async () => {
    const llm = vi.spyOn(h.app.get<LlmPort>(LLM_PORT), "complete");
    const view = await offer();
    const first = await open(view);
    expect(first.status).toBe(201);
    expect(first.body.source).toBe("COIN");
    expect(first.body.narration.narration).toBeTruthy();
    expect(await coins()).toBe(75);
    expect((await open(view)).body).toEqual(first.body);
    await h.set("ai.enabled", false); await h.set("economy.enabled", false);
    await h.set("coaching.weekly_recap.ai_enabled", false);
    await h.set("coaching.weekly_recap.coin_limit", 0);
    const reread = await request(h.app.getHttpServer()).get(`/v1/coach/weekly-recaps/${first.body.id}`)
      .set({ ...headers(), "Accept-Language": "en" });
    expect(reread.body).toEqual(first.body);
    expect((await archive()).body.items[0].id).toBe(first.body.id);
    expect((await offer()).canOpen).toBe(true);
    await h.set("coaching.weekly_recap.access_enabled", false);
    const legacyRead = await request(h.app.getHttpServer()).post("/v1/coach/weekly-review")
      .set(headers()).send({ examId: exams[0] });
    expect(legacyRead.status).toBe(200);
    expect(legacyRead.body.narration).toBe(first.body.narration.narration);
    expect(llm).toHaveBeenCalledOnce();
    expect(await coins()).toBe(75);
  });

  it("earns one first report without email verification or Coin allowance", async () => {
    await h.set("coaching.weekly_recap.free_enabled", true);
    const view = await offer();
    expect(view).toMatchObject({ mode: "EARNED", canOpen: true });
    expect(view.teaser).toEqual({ activeDays: 1, focusMinutes: 0, topSubject: null });
    expect((await open()).status).toBe(201);
    expect(await coins()).toBe(100);
    expect(await offer(exams[1])).toMatchObject({ mode: "COIN", coinRemaining: 2 });
    await h.set("coaching.weekly_recap.free_limit", 2);
    expect((await offer(exams[1])).mode).toBe("EARNED");
  });

  it("offers the earned path to unverified users and never charges an incomplete week", async () => {
    await h.set("coaching.weekly_recap.free_enabled", true);
    await h.set("economy.coin.deep_analysis_cost", 101);
    expect(await offer()).toMatchObject({ mode: "EARNED", canOpen: true });
    user = await h.signup();
    expect((await offer()).ready).toBe(false);
    expect((await open()).status).not.toBe(201);
    expect(await coins()).toBe(0);
  });

  it("reserves the last Coin slot across concurrent requests for different exams", async () => {
    await h.set("coaching.weekly_recap.coin_limit", 1);
    const views = await Promise.all([offer(), offer(exams[1])]);
    const results = await Promise.all(views.map((view) => open(view)));
    expect(results.map((r) => r.status).sort()).toEqual([201, 429]);
    expect(await coins()).toBe(75);
  });

  it("counts legacy purchases in the rolling window and honors a changed duration", async () => {
    for (const suffix of ["2026-01-05", "2026-01-12"])
      await h.economy.spend(user.id, 25, { reason: "analysis.deep.purchase", refType: "deep_analysis", refId: `${user.id}:${exams[0]}:${suffix}` });
    expect(await offer()).toMatchObject({ coinRemaining: 0, reason: "WEEKLY_RECAP_LIMIT_REACHED" });
    await h.tx(async (db) => { await db.query("update ledger_entries set created_at=now()-interval '31 days' where user_id=$1 and ref_type='deep_analysis'", [user.id]); });
    expect((await offer()).coinRemaining).toBe(2);
    await h.set("coaching.weekly_recap.coin_window_days", 60);
    expect((await offer()).coinRemaining).toBe(0);
    await h.set("coaching.weekly_recap.coin_limit", 3);
    expect((await offer()).coinRemaining).toBe(1);
  });

  it("rejects stale quotes and model failures without spending or consuming a use", async () => {
    const view = await offer(); await h.set("economy.coin.deep_analysis_cost", 30);
    expect((await open(view)).body.code).toBe("WEEKLY_RECAP_PRICE_CHANGED");
    const llm = vi.spyOn(h.app.get<LlmPort>(LLM_PORT), "complete").mockRejectedValueOnce(new Error("provider unavailable"));
    expect((await open()).status).toBe(503);
    expect(await coins()).toBe(100);
    expect((await offer()).coinRemaining).toBe(2);
    expect((await open()).status).toBe(201);
    expect(llm).toHaveBeenCalledTimes(2);
  });

  it("does not grant broader access through the legacy Coin purchase endpoint", async () => {
    expect((await request(h.app.getHttpServer()).post("/v1/economy/deep-analysis").set(headers())
      .send({ examId: exams[0] })).status).toBe(409);
    expect(await coins()).toBe(100);
  });

  it("deduplicates concurrent requests for the same report and protects idempotency headers", async () => {
    const view = await offer(); const id = randomUUID();
    expect((await request(h.app.getHttpServer()).post("/v1/coach/weekly-recaps").set(headers()).send({
      examId: view.examId, weekStart: view.weekStart, source: view.mode, expectedCost: view.cost, clientRequestId: id,
    })).status).toBe(400);
    const llm = vi.spyOn(h.app.get<LlmPort>(LLM_PORT), "complete");
    const results = await Promise.all([open(view, undefined, id), open(view, undefined, id)]);
    expect(results.some((r) => r.status === 201)).toBe(true);
    expect(results.every((r) => [201, 409].includes(r.status))).toBe(true);
    expect(await coins()).toBe(75); expect(llm).toHaveBeenCalledOnce();
  });

  it("serializes the single earned allowance across concurrent exams without Coin debits", async () => {
    await h.set("coaching.weekly_recap.free_enabled", true);
    const views = await Promise.all([offer(), offer(exams[1])]);
    const results = await Promise.all(views.map((view) => open(view)));
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(await coins()).toBe(100);
  });

  it("recovers an unpaid generated report at its original quote without another model call", async () => {
    const llm = h.app.get<LlmPort>(LLM_PORT); const original = llm.complete.bind(llm);
    const calls = vi.spyOn(llm, "complete").mockImplementationOnce(async (input) => {
      const result = await original(input);
      await h.economy.spend(user.id, 100, { reason: "qa.other", refType: "qa", refId: randomUUID() });
      return result;
    });
    expect((await open()).body.code).toBe("INSUFFICIENT_COIN");
    await h.set("economy.coin.deep_analysis_cost", 30);
    await h.economy.grant(user.id, Currency.COIN, 25, { reason: "qa.recover", enforceLimits: false });
    expect(await offer()).toMatchObject({ mode: "COIN", cost: 25, canOpen: true });
    expect((await open()).status).toBe(201);
    expect(await coins()).toBe(0); expect(calls).toHaveBeenCalledOnce();
  });

  it("preserves a legacy paid right and its original narration even with AI/economy off", async () => {
    const weekStart = weeklyReviewWindows().startDate;
    await h.economy.spend(user.id, 25, { reason: "analysis.deep.purchase", refType: "deep_analysis", refId: `${user.id}:${exams[0]}:${weekStart}` });
    await h.app.get(WeeklyReviewCacheRepository).upsert({ userId: user.id, examId: exams[0]!, weekStart,
      locale: "en", sourceFingerprint: "legacy", narration: "Your saved reflection.", model: "fake" });
    const llm = vi.spyOn(h.app.get<LlmPort>(LLM_PORT), "complete");
    expect((await archive()).body.items[0].requiresOpening).toBe(true);
    await h.set("ai.enabled", false); await h.set("economy.enabled", false);
    expect(await offer()).toMatchObject({ mode: "OWNED", canOpen: true, cost: 0 });
    const report = await open(); expect(report.status).toBe(201);
    expect(report.body.locale).toBe("en"); expect(report.body.narration.narration).toBe("Your saved reflection.");
    expect((await archive()).body.total).toBe(1);
    expect(await coins()).toBe(75); expect(llm).not.toHaveBeenCalled();
  });

  it("refuses a closed AI budget without starting generation or spending Coin", async () => {
    const llm = vi.spyOn(h.app.get<LlmPort>(LLM_PORT), "complete");
    await h.app.get(AiUsageRepository).append({ userId: user.id, model: "qa", feature: "qa",
      promptTokens: 0, completionTokens: 0, costMicros: 20000 });
    await h.set("ai.budget.monthly_cap_usd_cents", 1);
    expect((await offer()).reason).toBe("AI_BUDGET_EXCEEDED");
    expect((await open()).status).toBe(503);
    expect(await coins()).toBe(100); expect(llm).not.toHaveBeenCalled();
  });

  it("fences a resumed expired worker before it can overwrite the winner's saved narration", async () => {
    let unblock!: () => void; let entered!: () => void;
    const waiting = new Promise<void>((resolve) => { unblock = resolve; });
    const started = new Promise<void>((resolve) => { entered = resolve; });
    const llm = vi.spyOn(h.app.get<LlmPort>(LLM_PORT), "complete")
      .mockImplementationOnce(async () => { entered(); await waiting;
        return { text: "Late worker", model: "fake", promptTokens: 1, completionTokens: 1 }; })
      .mockResolvedValueOnce({ text: "Winning worker", model: "fake", promptTokens: 1, completionTokens: 1 });
    const view = await offer(); const late = open(view);
    await started;
    await h.tx(async (db) => { await db.query("update ai_weekly_recaps set expires_at=now()-interval '1 second' where user_id=$1", [user.id]); });
    const winner = await open(view); expect(winner.status).toBe(201);
    unblock(); expect((await late).status).toBe(409);
    expect((await open(view)).body.narration.narration).toBe("Winning worker");
    const cache = await h.app.get(WeeklyReviewCacheRepository).findAny(user.id, exams[0]!, view.weekStart);
    expect(cache?.narration).toBe("Winning worker");
    expect(await coins()).toBe(75); expect(llm).toHaveBeenCalledTimes(2);
  });

  it("paginates mixed legacy report ownership without discarding older rights", async () => {
    for (const week of ["2026-01-05", "2026-01-12", "2026-01-19", "2026-01-26", "2026-02-02"])
      await h.economy.spend(user.id, 1, { reason: "analysis.deep.purchase", refType: "deep_analysis", refId: `${user.id}:${exams[0]}:${week}` });
    const first = await request(h.app.getHttpServer()).get("/v1/coach/weekly-recaps?page=1&pageSize=2").set(headers());
    const second = await request(h.app.getHttpServer()).get("/v1/coach/weekly-recaps?page=2&pageSize=2").set(headers());
    expect(first.body).toMatchObject({ total: 5, page: 1, pageSize: 2 });
    expect(first.body.items).toHaveLength(2); expect(second.body.items).toHaveLength(2);
    expect(new Set([...first.body.items, ...second.body.items].map((row: { id: string }) => row.id)).size).toBe(4);
  });

  it("preserves Premium reports after membership expiry and does not consume the earned grant", async () => {
    user = await weeklyAccount(h.app, h.pool, true);
    const first = await open(); expect(first.status).toBe(201); expect(first.body.source).toBe("PREMIUM");
    expect(await coins()).toBe(0);
    await h.tx(async (db) => { await db.query("update subscriptions set status='EXPIRED',current_period_end=now()-interval '1 day' where user_id=$1", [user.id]); });
    await h.set("coaching.weekly_recap.free_enabled", true);
    expect((await offer()).mode).toBe("OWNED");
    expect((await offer(exams[1])).mode).toBe("EARNED");
  });

  it("offers explicit Coin settlement for saved earned output after another report uses the grant", async () => {
    await h.set("coaching.weekly_recap.free_enabled", true);
    const calls = vi.spyOn(h.app.get<LlmPort>(LLM_PORT), "complete");
    const first = await open(); expect(first.status).toBe(201);
    await h.tx(async (db) => { await db.query("update ai_weekly_recaps set status='GENERATED',opened_at=null,expires_at=now()-interval '1 second' where id=$1", [first.body.id]); });
    expect((await open(await offer(exams[1]))).status).toBe(201);
    expect(await offer()).toMatchObject({ mode: "COIN", cost: 25, canOpen: true });
    const paid = await open(); expect(paid.status).toBe(201); expect(paid.body.source).toBe("COIN");
    expect(calls).toHaveBeenCalledTimes(2); expect(await coins()).toBe(75);
  });

  it("isolates saved reports by owner and erases private snapshots without deleting Coin history", async () => {
    const first = await open(); expect(first.status).toBe(201);
    const other = await h.signup();
    expect((await request(h.app.getHttpServer()).get(`/v1/coach/weekly-recaps/${first.body.id}`)
      .set({ Authorization: `Bearer ${other.token}` })).status).toBe(404);
    await h.app.get(AiErasureService).eraseUserData(user.id);
    expect((await archive()).body.items.every((row: { requiresOpening?: boolean }) => row.requiresOpening)).toBe(true);
    expect((await request(h.app.getHttpServer()).get(`/v1/coach/weekly-recaps/${first.body.id}`).set(headers())).status).toBe(404);
    expect(await coins()).toBe(75);
  });
});
