import { beforeEach, describe, expect, it, vi } from "vitest";
import { Currency } from "@mentor/types";
import { FeatureFlag } from "../../../common/config/config.catalog";
import { ChatService } from "./chat.service";

const USER = { id: "user-1", roles: [] as string[], orgId: null };
const MSG_ID = "00000000-0000-4000-8000-000000000099";
const CONV_ID = "00000000-0000-4000-8000-0000000000c1";
const MOCK_EXAM_ID = "00000000-0000-4000-8000-0000000000e1";
const MOCK_EXAM = {
  id: MOCK_EXAM_ID,
  examId: "00000000-0000-4000-8000-0000000000e2",
  examName: "KPSS Genel Yetenek",
  takenAt: "2026-07-13T12:00:00.000Z",
  totalNet: "72.50",
  publisherName: "SECRET PUBLISHER",
  subjects: [
    {
      subjectRef: "math",
      subjectName: "Matematik",
      correct: 30,
      wrong: 8,
      blank: 2,
      net: "28.00",
    },
  ],
};

describe("ChatService coin refund", () => {
  let service: ChatService;
  let llmComplete: ReturnType<typeof vi.fn>;
  let spend: ReturnType<typeof vi.fn>;
  let grant: ReturnType<typeof vi.fn>;
  let llmCompleteStream: ReturnType<typeof vi.fn>;
  let lastN: ReturnType<typeof vi.fn>;
  let appendExchange: ReturnType<typeof vi.fn>;
  let updateCoachReply: ReturnType<typeof vi.fn>;
  let createConversation: ReturnType<typeof vi.fn>;
  let isOwned: ReturnType<typeof vi.fn>;
  let getMockExam: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    llmComplete = vi.fn();
    llmCompleteStream = vi.fn();
    spend = vi.fn();
    grant = vi.fn();
    lastN = vi.fn(async () => []);
    appendExchange = vi.fn(async () => undefined);
    updateCoachReply = vi.fn(async () => true);
    createConversation = vi.fn(async () => CONV_ID);
    isOwned = vi.fn(async () => true);
    getMockExam = vi.fn(async () => MOCK_EXAM);

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
        recentForUser: vi.fn(async () => []),
        appendExchange,
        updateCoachReply,
        listPagedByConversation: vi.fn(),
        setFeedback: vi.fn(),
      } as never,
      {
        create: createConversation,
        isOwned,
        listPaged: vi.fn(),
        delete: vi.fn(),
      } as never,
      { get: vi.fn(async () => null), upsert: vi.fn(), clear: vi.fn() } as never,
      { assertWithinBudget: vi.fn(async () => undefined) } as never,
      { enqueue: vi.fn(async () => undefined) } as never,
      { getById: getMockExam } as never,
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

    expect(appendExchange).toHaveBeenCalledWith(USER.id, CONV_ID, "Merhaba", {
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
      { done: { reply: "Merhaba!", model: "fake", conversationId: CONV_ID, sources: [] } },
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
    expect(appendExchange).toHaveBeenCalledWith(USER.id, CONV_ID, "Bana görev öner", {
      content: "Harika!",
      model: "fake",
      sources: [],
      suggestedTask: { title: "Tarih: 10 soru", subject: "Tarih" },
    });
  });

  it("extracts follow-ups (before the trailing task marker) and persists the cleaned reply", async () => {
    llmComplete.mockResolvedValue({
      text: 'Harika!\n<<FOLLOWUP["Soru bir?","Soru iki?"]>>\n<<TASK{"title":"Tarih: 10 soru","subject":"Tarih"}>>',
      promptTokens: 1,
      completionTokens: 1,
      model: "fake",
    });

    const res = await service.reply(USER, "Bana görev öner", MSG_ID);

    expect(res.reply).toBe("Harika!");
    expect(res.followUps).toEqual(["Soru bir?", "Soru iki?"]);
    expect(res.suggestedTask).toEqual({ title: "Tarih: 10 soru", subject: "Tarih" });
    expect(appendExchange).toHaveBeenCalledWith(
      USER.id,
      CONV_ID,
      "Bana görev öner",
      expect.objectContaining({ content: "Harika!" }),
    );
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
        conversationId: CONV_ID,
        sources: [],
        suggestedTask: { title: "Mat: 20 soru", subject: "Matematik" },
      },
    });
  });

  it("opens a new thread titled after the message when no conversationId is given", async () => {
    llmComplete.mockResolvedValue({ text: "Yanıt", promptTokens: 1, completionTokens: 1, model: "fake" });

    const res = await service.reply(USER, "Türkçe paragrafta zorlanıyorum", MSG_ID);

    expect(createConversation).toHaveBeenCalledWith(USER.id, "Türkçe paragrafta zorlanıyorum");
    expect(res.conversationId).toBe(CONV_ID);
    // History window is scoped to the new thread, not the whole user.
    expect(lastN).toHaveBeenCalledWith(USER.id, CONV_ID, expect.any(Number));
  });

  it("reuses an owned thread and does not create a new one", async () => {
    llmComplete.mockResolvedValue({ text: "Yanıt", promptTokens: 1, completionTokens: 1, model: "fake" });
    const existing = "00000000-0000-4000-8000-0000000000c2";

    const res = await service.reply(USER, "Devam", MSG_ID, existing);

    expect(isOwned).toHaveBeenCalledWith(USER.id, existing);
    expect(createConversation).not.toHaveBeenCalled();
    expect(res.conversationId).toBe(existing);
    expect(lastN).toHaveBeenCalledWith(USER.id, existing, expect.any(Number));
  });

  it("rejects a thread the user does not own", async () => {
    isOwned.mockResolvedValue(false);

    await expect(
      service.reply(USER, "Başkasının thread'i", MSG_ID, "00000000-0000-4000-8000-0000000000c9"),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(llmComplete).not.toHaveBeenCalled();
  });

  it("still replies when history load fails (defensive)", async () => {
    lastN.mockRejectedValue(new Error("db down"));
    llmComplete.mockResolvedValue({ text: "Yanıt", promptTokens: 1, completionTokens: 1, model: "fake" });

    const res = await service.reply(USER, "Merhaba", MSG_ID);

    expect(res.reply).toBe("Yanıt");
    expect(llmComplete).toHaveBeenCalledWith(expect.objectContaining({ history: [] }));
  });
  it("loads an owned mock exam and adds only its safe authoritative summary to blocking chat", async () => {
    llmComplete.mockResolvedValue({ text: "Yanıt", promptTokens: 1, completionTokens: 1, model: "fake" });

    await service.reply(USER, "Bu denemeyi yorumla", MSG_ID, undefined, MOCK_EXAM_ID);

    expect(getMockExam).toHaveBeenCalledWith(USER.id, MOCK_EXAM_ID);
    const llmInput = llmComplete.mock.calls[0]?.[0] as { system: string };
    expect(llmInput.system).toContain("KPSS Genel Yetenek");
    expect(llmInput.system).toContain("toplam net: 72.50");
    expect(llmInput.system).toContain("Matematik: D 30, Y 8, Boş 2, net 28.00");
    expect(llmInput.system).not.toContain("SECRET PUBLISHER");
  });

  it("does not create a conversation or call the LLM when mock-exam ownership validation fails", async () => {
    const notFound = Object.assign(new Error("not found"), {
      code: "COACHING_MOCK_EXAM_NOT_FOUND",
    });
    getMockExam.mockRejectedValue(notFound);

    await expect(
      service.reply(USER, "Bu denemeyi yorumla", MSG_ID, undefined, MOCK_EXAM_ID),
    ).rejects.toBe(notFound);

    expect(createConversation).not.toHaveBeenCalled();
    expect(llmComplete).not.toHaveBeenCalled();
    expect(grant).toHaveBeenCalledWith(
      USER.id,
      Currency.COIN,
      5,
      expect.objectContaining({ refId: MSG_ID }),
    );
  });

  it("uses the same mock-exam context path for streaming chat", async () => {
    llmCompleteStream.mockImplementation(async function* () {
      yield { delta: "Yanıt" };
      yield { final: { text: "Yanıt", promptTokens: 1, completionTokens: 1, model: "fake" } };
    });

    const events = [];
    for await (const event of service.replyStream(
      USER,
      "Bu denemeyi yorumla",
      MSG_ID,
      undefined,
      MOCK_EXAM_ID,
    )) {
      events.push(event);
    }

    expect(events.at(-1)).toMatchObject({ done: { reply: "Yanıt" } });
    expect(getMockExam).toHaveBeenCalledWith(USER.id, MOCK_EXAM_ID);
    expect(llmCompleteStream).toHaveBeenCalledWith(
      expect.objectContaining({ system: expect.stringContaining("toplam net: 72.50") }),
    );
  });

  // ---- regenerate ----

  const TAIL = [
    { id: "m-user", role: "USER", content: "Nasıl çalışmalıyım?", sources: [], feedback: null, createdAt: "t1" },
    { id: "m-coach", role: "COACH", content: "Eski yanıt.", sources: [], feedback: -1, createdAt: "t2" },
  ];

  it("regenerate overwrites the coach row in place — no new exchange, no memory trigger", async () => {
    lastN.mockResolvedValue(TAIL);
    llmCompleteStream.mockImplementation(async function* () {
      yield { delta: "Yeni yanıt." };
      yield { final: { text: "Yeni yanıt.", promptTokens: 1, completionTokens: 1, model: "fake" } };
    });

    const events: unknown[] = [];
    for await (const ev of service.regenerateStream(USER, CONV_ID)) events.push(ev);

    expect(events.at(-1)).toMatchObject({
      done: { reply: "Yeni yanıt.", conversationId: CONV_ID },
    });
    expect(updateCoachReply).toHaveBeenCalledWith(
      USER.id,
      "m-coach",
      expect.objectContaining({ content: "Yeni yanıt.", model: "fake" }),
    );
    expect(appendExchange).not.toHaveBeenCalled();
    // The old (disliked) reply must not be replayed into the prompt history.
    expect(llmCompleteStream).toHaveBeenCalledWith(
      expect.objectContaining({ user: "Nasıl çalışmalıyım?", history: [] }),
    );
  });

  it("regenerate rejects a thread that does not end in a completed exchange", async () => {
    lastN.mockResolvedValue([]);

    const consume = async () => {
      for await (const ev of service.regenerateStream(USER, CONV_ID)) void ev;
    };
    await expect(consume()).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(llmCompleteStream).not.toHaveBeenCalled();
    expect(spend).not.toHaveBeenCalled();
  });

  it("regenerate rejects a thread the user does not own", async () => {
    isOwned.mockResolvedValue(false);

    const consume = async () => {
      for await (const ev of service.regenerateStream(USER, CONV_ID)) void ev;
    };
    await expect(consume()).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("regenerate refunds the coin and leaves the row untouched on a mid-stream failure", async () => {
    lastN.mockResolvedValue(TAIL);
    llmCompleteStream.mockImplementation(async function* () {
      yield { delta: "Yarı" };
      throw new Error("LLM down");
    });

    const consume = async () => {
      for await (const ev of service.regenerateStream(USER, CONV_ID)) void ev;
    };
    await expect(consume()).rejects.toThrow("LLM down");

    expect(updateCoachReply).not.toHaveBeenCalled();
    expect(grant).toHaveBeenCalledWith(
      USER.id,
      Currency.COIN,
      5,
      expect.objectContaining({ refId: expect.any(String) }),
    );
  });
});
