import { beforeEach, describe, expect, it, vi } from "vitest";
import { Currency } from "@mentor/types";
import { FeatureFlag } from "../../../common/config/config.catalog";
import { ChatService } from "./chat.service";

const USER = { id: "user-1", roles: [] as string[], orgId: null };
const MSG_ID = "00000000-0000-4000-8000-000000000099";

describe("ChatService coin refund", () => {
  let service: ChatService;
  let llmComplete: ReturnType<typeof vi.fn>;
  let spend: ReturnType<typeof vi.fn>;
  let grant: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    llmComplete = vi.fn();
    spend = vi.fn();
    grant = vi.fn();

    const config = {
      get: vi.fn(async (key: string) => {
        if (key === FeatureFlag.AI_ENABLED) return true;
        if (key === FeatureFlag.ECONOMY_ENABLED) return true;
        if (key === "economy.coin.ai_chat_cost") return 5;
        if (key === "ai.chat.free_coin_daily_limit") return 5;
        return 0;
      }),
    };

    const entitlement = {
      getEntitlement: vi.fn(async () => ({ isPremium: false })),
    };

    spend.mockResolvedValue({ balance: { coinConfirmed: 10 }, alreadySpent: false });
    grant.mockResolvedValue({ coinConfirmed: 10 });

    service = new ChatService(
      { complete: llmComplete, embed: vi.fn() } as never,
      { build: vi.fn(async () => ({ examType: null, daysRemaining: null, examDateLabel: null })) } as never,
      { append: vi.fn(), countSince: vi.fn() } as never,
      { searchSimilarArticles: vi.fn() } as never,
      config as never,
      entitlement as never,
      {
        spend,
        grant,
        coinChatSpendsSince: vi.fn(async () => 0),
      } as never,
    );
  });

  it("refunds coin when LLM fails after a fresh spend", async () => {
    llmComplete.mockRejectedValue(new Error("LLM down"));

    await expect(service.reply(USER, "Merhaba", MSG_ID)).rejects.toThrow("LLM down");

    expect(spend).toHaveBeenCalledOnce();
    expect(grant).toHaveBeenCalledWith(
      USER.id,
      Currency.COIN,
      5,
      expect.objectContaining({ refId: MSG_ID }),
    );
  });

  it("does not refund on idempotent retry when spend was already recorded", async () => {
    spend.mockResolvedValue({ balance: { coinConfirmed: 5 }, alreadySpent: true });
    llmComplete.mockRejectedValue(new Error("LLM down"));

    await expect(service.reply(USER, "Tekrar", MSG_ID)).rejects.toThrow("LLM down");

    expect(spend).toHaveBeenCalledOnce();
    expect(grant).not.toHaveBeenCalled();
  });
});
