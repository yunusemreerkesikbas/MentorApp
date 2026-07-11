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
  let llmCompleteStream: ReturnType<typeof vi.fn>;
  let lastN: ReturnType<typeof vi.fn>;
  let appendExchange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    llmComplete = vi.fn();
    llmCompleteStream = vi.fn();
    spend = vi.fn();
    grant = vi.fn();
    lastN = vi.fn(async () => []);
    appendExchange = vi.fn(async () => undefined);

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
      { complete: llmComplete, completeStream: llmCompleteStream, embed: vi.fn() } as never,
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
      {
        lastN,
        appendExchange,
        listPaged: vi.fn(),
        clearAll: vi.fn(),
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

  it("replays persisted history into the LLM call (USER→user, COACH→assistant)", async () => {
    lastN.mockResolvedValue([
      { id: "m1", role: "USER", content: "Önceki soru", sources: [], createdAt: "t" },
      { id: "m2", role: "COACH", content: "Önceki yanıt", sources: [], createdAt: "t" },
    ]);
    llmComplete.mockResolvedValue({ text: "Yanıt", promptTokens: 1, completionTokens: 1, model: "fake" });

    await service.reply(USER, "Yeni soru", MSG_ID);

    expect(llmComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        history: [
          { role: "user", content: "Önceki soru" },
          { role: "assistant", content: "Önceki yanıt" },
        ],
      }),
    );
  });

  it("persists the exchange only after a successful reply", async () => {
    llmComplete.mockResolvedValue({ text: "Yanıt", promptTokens: 1, completionTokens: 1, model: "fake" });

    await service.reply(USER, "Merhaba", MSG_ID);

    expect(appendExchange).toHaveBeenCalledWith(USER.id, "Merhaba", {
      content: "Yanıt",
      model: "fake",
      sources: [],
    });
  });

  it("persists nothing when the LLM call fails", async () => {
    llmComplete.mockRejectedValue(new Error("LLM down"));

    await expect(service.reply(USER, "Merhaba", MSG_ID)).rejects.toThrow("LLM down");

    expect(appendExchange).not.toHaveBeenCalled();
  });

  it("streams deltas then a done event, persisting the exchange once", async () => {
    llmCompleteStream.mockImplementation(async function* () {
      yield { delta: "Merha" };
      yield { delta: "ba!" };
      yield { final: { text: "Merhaba!", promptTokens: 1, completionTokens: 1, model: "fake" } };
    });

    const events = [];
    for await (const ev of service.replyStream(USER, "Selam", MSG_ID)) events.push(ev);

    expect(events).toEqual([
      { delta: "Merha" },
      { delta: "ba!" },
      { done: { reply: "Merhaba!", model: "fake", sources: [] } },
    ]);
    expect(appendExchange).toHaveBeenCalledOnce();
  });

  it("refunds coin and persists nothing when the stream fails mid-flight", async () => {
    llmCompleteStream.mockImplementation(async function* () {
      yield { delta: "Merha" };
      throw new Error("stream down");
    });

    const events: unknown[] = [];
    await expect(async () => {
      for await (const ev of service.replyStream(USER, "Selam", MSG_ID)) events.push(ev);
    }).rejects.toThrow("stream down");

    expect(events).toEqual([{ delta: "Merha" }]);
    expect(grant).toHaveBeenCalledWith(
      USER.id,
      Currency.COIN,
      5,
      expect.objectContaining({ refId: MSG_ID }),
    );
    expect(appendExchange).not.toHaveBeenCalled();
  });

  it("extracts a suggested task and persists the cleaned reply", async () => {
    llmComplete.mockResolvedValue({
      text: 'Harika!\n<<TASK{"title":"Tarih: 10 soru","subject":"Tarih"}>>',
      promptTokens: 1,
      completionTokens: 1,
      model: "fake",
    });

    const res = await service.reply(USER, "Bana görev öner", MSG_ID);

    expect(res.reply).toBe("Harika!");
    expect(res.suggestedTask).toEqual({ title: "Tarih: 10 soru", subject: "Tarih" });
    expect(appendExchange).toHaveBeenCalledWith(USER.id, "Bana görev öner", {
      content: "Harika!",
      model: "fake",
      sources: [],
    });
  });

  it("never leaks the task marker into stream deltas; done carries the suggestion", async () => {
    llmCompleteStream.mockImplementation(async function* () {
      yield { delta: "Bugün 20 soru çöz. " };
      yield { delta: '<<TASK{"title":"Mat: 20 soru",' };
      yield { delta: '"subject":"Matematik"}>>' };
      yield {
        final: {
          text: 'Bugün 20 soru çöz. <<TASK{"title":"Mat: 20 soru","subject":"Matematik"}>>',
          promptTokens: 1,
          completionTokens: 1,
          model: "fake",
        },
      };
    });

    const events: unknown[] = [];
    for await (const ev of service.replyStream(USER, "görev", MSG_ID)) events.push(ev);

    const streamedText = events
      .filter((e): e is { delta: string } => typeof (e as { delta?: string }).delta === "string")
      .map((e) => e.delta)
      .join("");
    expect(streamedText).not.toContain("<<TASK");
    expect(events.at(-1)).toEqual({
      done: {
        reply: "Bugün 20 soru çöz.",
        model: "fake",
        sources: [],
        suggestedTask: { title: "Mat: 20 soru", subject: "Matematik" },
      },
    });
  });

  it("still replies when history load fails (defensive)", async () => {
    lastN.mockRejectedValue(new Error("db down"));
    llmComplete.mockResolvedValue({ text: "Yanıt", promptTokens: 1, completionTokens: 1, model: "fake" });

    const res = await service.reply(USER, "Merhaba", MSG_ID);

    expect(res.reply).toBe("Yanıt");
    expect(llmComplete).toHaveBeenCalledWith(expect.objectContaining({ history: [] }));
  });
});
