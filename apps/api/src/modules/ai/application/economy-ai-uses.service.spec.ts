import { describe, expect, it, vi } from "vitest";
import { EconomyUsesRegistry } from "../../economy/application/economy-uses.registry";
import { EconomyAiUsesService } from "./economy-ai-uses.service";

function setup() {
  const cfg = { "ai.enabled": true };
  const chat = {
    getAccess: vi.fn(
      async () =>
        ({
          canChat: true,
          mode: "COIN",
          chatCost: 7,
          freeCoinMessagesRemainingToday: 3,
        }) as {
          canChat: boolean;
          mode: string;
          chatCost?: number;
          freeCoinMessagesRemainingToday?: number;
          dailyMessagesRemaining?: number;
          reason?: string;
        },
    ),
  };
  const ent = { getEntitlement: vi.fn(async () => ({ isPremium: false })) };
  const users = {
    getMe: vi.fn(async () => ({
      examType: "KPSS" as string | null,
      examVariant: "LISANS",
    })),
  };
  const content = {
    getCurrentExamByFamily: vi.fn(async () => ({ id: "exam" })),
  };
  const state = {
    eligible: true,
    weekStart: "2026-10-19",
    cost: 29,
    unlocked: false,
    purchased: false,
    generationAvailable: true,
  };
  const deep = {
    getState: vi.fn(async () => state),
  };
  const registry = new EconomyUsesRegistry();
  const service = new EconomyAiUsesService(
    registry,
    chat as never,
    ent as never,
    { get: async (key: keyof typeof cfg) => cfg[key] } as never,
    users as never,
    content as never,
    deep as never,
    { get: vi.fn(async () => ({ mode: "NONE", canGenerate: false, cost: null, dailyRemaining: 0, latestRequestId: null })) } as never,
  );
  service.onModuleInit();
  const views = (coin = 50) => registry.resolve("user", [], coin);
  return { views, cfg, chat, ent, users, content, state, deep };
}

describe("EconomyAiUsesService", () => {
  it("reuses chat eligibility, dynamic prices and daily allowance", async () => {
    const s = setup();
    expect(await s.views()).toMatchObject([
      { id: "COACH_CHAT", cost: 7, status: "AVAILABLE", dailyRemaining: 3 },
      { id: "DEEP_ANALYSIS", cost: 29, status: "AVAILABLE" },
      { id: "PLAN_PREVIEW", status: "UNAVAILABLE" },
    ]);
  });
  it("does not advertise generation while AI is disabled", async () => {
    const s = setup();
    s.cfg["ai.enabled"] = false;
    s.chat.getAccess.mockResolvedValue({
      canChat: false,
      mode: "NONE",
      reason: "AI_DISABLED",
    });
    expect(
      (await s.views()).every(
        (v) => v.status === "UNAVAILABLE" && !v.canOpen && v.cost === null,
      ),
    ).toBe(true);
    expect(s.deep.getState).not.toHaveBeenCalled();
  });
  it("keeps Premium included while preserving its daily refusal", async () => {
    const s = setup();
    s.ent.getEntitlement.mockResolvedValue({ isPremium: true });
    s.chat.getAccess.mockResolvedValue({
      canChat: false,
      mode: "PREMIUM",
      reason: "AI_RATE_LIMITED",
      dailyMessagesRemaining: 0,
    });
    expect(await s.views()).toMatchObject([
      {
        cost: null,
        premiumIncluded: true,
        status: "DAILY_LIMIT_REACHED",
        canOpen: false,
      },
      { cost: null, premiumIncluded: true, status: "PREMIUM_INCLUDED" },
      { id: "PLAN_PREVIEW", status: "UNAVAILABLE" },
    ]);
  });
  it("distinguishes insufficient Coin from an unready weekly report", async () => {
    const s = setup();
    s.state.eligible = false;
    expect((await s.views(0))[1].status).toBe("REVIEW_NOT_READY");
    s.state.eligible = true;
    expect((await s.views(0))[1]).toMatchObject({
      status: "INSUFFICIENT_COIN",
      canOpen: false,
    });
  });
  it("keeps an owned weekly right distinct from a new purchase even if generation budget closes", async () => {
    const s = setup();
    s.state.purchased = true;
    s.state.unlocked = true;
    s.state.generationAvailable = false;
    expect((await s.views(0))[1]).toMatchObject({
      status: "ALREADY_UNLOCKED",
      cost: null,
      canOpen: true,
    });
  });
  it("blocks a new generation offer over budget without inventing an exam", async () => {
    const s = setup();
    s.state.generationAvailable = false;
    expect((await s.views())[1]).toMatchObject({
      status: "UNAVAILABLE",
      cost: null,
    });
    s.users.getMe.mockResolvedValue({ examType: null, examVariant: "LISANS" });
    expect((await s.views())[1].status).toBe("NEEDS_EXAM");
  });
  it("recognizes conditional included access and never sells a zero-cost spend", async () => {
    const s = setup();
    s.state.unlocked = true;
    expect((await s.views())[1]).toMatchObject({
      status: "INCLUDED",
      cost: null,
    });
    s.state.unlocked = false;
    s.state.cost = 0;
    expect((await s.views())[1]).toMatchObject({
      status: "UNAVAILABLE",
      canOpen: false,
    });
  });
  it("uses the owning offer's capped allowance rather than maintaining another policy", async () => {
    const s = setup();
    expect((await s.views())[1]).toMatchObject({
      status: "AVAILABLE",
      canOpen: true,
      cost: 29,
    });
    s.state.unlocked = true;
    expect((await s.views())[1]).toMatchObject({
      status: "INCLUDED",
      canOpen: true,
      cost: null,
    });
  });
  it("labels a conditional chat taste as included without calling it Premium", async () => {
    const s = setup();
    s.chat.getAccess.mockResolvedValue({
      canChat: true,
      mode: "PREMIUM",
      dailyMessagesRemaining: 1,
    });
    expect((await s.views())[0]).toMatchObject({
      status: "INCLUDED",
      cost: null,
      premiumIncluded: false,
      dailyRemaining: 1,
    });
  });
  it("keeps insufficient chat Coin blocked and does not advertise a zero-cost spend", async () => {
    const s = setup();
    s.chat.getAccess.mockResolvedValue({
      canChat: false,
      mode: "NONE",
      chatCost: 7,
      reason: "INSUFFICIENT_COIN",
    });
    expect((await s.views())[0]).toMatchObject({
      status: "INSUFFICIENT_COIN",
      cost: 7,
      canOpen: false,
    });
    s.chat.getAccess.mockResolvedValue({
      canChat: true,
      mode: "COIN",
      chatCost: 0,
    });
    expect((await s.views())[0]).toMatchObject({
      status: "UNAVAILABLE",
      cost: null,
      canOpen: false,
    });
  });
});
