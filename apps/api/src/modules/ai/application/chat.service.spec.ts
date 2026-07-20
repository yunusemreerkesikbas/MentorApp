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
  let persistExchange: ReturnType<typeof vi.fn>;
  let updateCoachReply: ReturnType<typeof vi.fn>;
  let listPagedByConversation: ReturnType<typeof vi.fn>;
  let isOwned: ReturnType<typeof vi.fn>;
  let getMockExam: ReturnType<typeof vi.fn>;
  let contextBuild: ReturnType<typeof vi.fn>;
  let getInfoArticleSource: ReturnType<typeof vi.fn>;
  let searchSimilarArticles: ReturnType<typeof vi.fn>;
  let llmEmbed: ReturnType<typeof vi.fn>;
  let usageAppend: ReturnType<typeof vi.fn>;
  let getExamCalendarByFamily: ReturnType<typeof vi.fn>;
  let budgetAssert: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    llmComplete = vi.fn();
    llmCompleteStream = vi.fn();
    spend = vi.fn();
    grant = vi.fn();
    lastN = vi.fn(async () => []);
    persistExchange = vi.fn(
      async (_userId: string, target: { kind: string; conversationId?: string }) =>
        target.kind === "existing" ? target.conversationId : CONV_ID,
    );
    updateCoachReply = vi.fn(async () => true);
    listPagedByConversation = vi.fn();
    isOwned = vi.fn(async () => true);
    getMockExam = vi.fn(async () => MOCK_EXAM);
    contextBuild = vi.fn(async () => ({
      examType: null,
    }));
    getInfoArticleSource = vi.fn();
    searchSimilarArticles = vi.fn();
    llmEmbed = vi.fn();

    usageAppend = vi.fn();
    getExamCalendarByFamily = vi.fn();
    budgetAssert = vi.fn(async () => undefined);
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

    spend.mockResolvedValue({
      balance: { coinConfirmed: 10 },
      alreadySpent: false,
    });
    grant.mockResolvedValue({ coinConfirmed: 10 });

    service = new ChatService(
      {
        complete: llmComplete,
        completeStream: llmCompleteStream,
        embed: llmEmbed,
      } as never,
      { build: contextBuild } as never,
      { append: usageAppend, countSince: vi.fn() } as never,
      {
        getInfoArticleSource,
        searchSimilarArticles,
        getExamCalendarByFamily,
      } as never,
      config as never,
      entitlement as never,
      {
        spend,
        grant,
        coinChatSpendsSince: vi.fn(async () => 0),
      } as never,
      {
        lastN,
        persistExchange,
        updateCoachReply,
        listPagedByConversation,
        setFeedback: vi.fn(),
      } as never,
      {
        isOwned,
        listPaged: vi.fn(),
        delete: vi.fn(),
      } as never,
      {
        get: vi.fn(async () => null),
        upsert: vi.fn(),
        clear: vi.fn(),
      } as never,
      { assertWithinBudget: budgetAssert } as never,
      { getById: getMockExam } as never,
      { translate: vi.fn((key: string) => key) } as never,
    );
  });

  it("refunds coin when LLM fails after a fresh spend", async () => {
    llmComplete.mockRejectedValue(new Error("LLM down"));

    await expect(service.reply(USER, "Merhaba", MSG_ID)).rejects.toThrow(
      "LLM down",
    );

    expect(spend).toHaveBeenCalledOnce();
    expect(grant).toHaveBeenCalledWith(
      USER.id,
      Currency.COIN,
      5,
      expect.objectContaining({ refId: MSG_ID }),
    );
    expect(persistExchange).not.toHaveBeenCalled();
  });

  it("creates a new thread atomically only after the completion succeeds", async () => {
    llmComplete.mockResolvedValue({
      text: "Yanıt",
      promptTokens: 1,
      completionTokens: 1,
      model: "fake",
    });

    const result = await service.reply(
      USER,
      "Türkçe paragrafta zorlanıyorum",
      MSG_ID,
    );
    expect(lastN).not.toHaveBeenCalled();
    expect(persistExchange).toHaveBeenCalledWith(
      USER.id,
      { kind: "new", title: "Türkçe paragrafta zorlanıyorum" },
      "Türkçe paragrafta zorlanıyorum",
      expect.objectContaining({ content: "Yanıt", model: "fake" }),
    );
    expect(result.conversationId).toBe(CONV_ID);
  });

  it("refunds coin but keeps actual usage when history persistence fails", async () => {
    llmComplete.mockResolvedValue({
      text: "Yanıt",
      promptTokens: 1,
      completionTokens: 1,
      model: "fake",
    });
    persistExchange.mockRejectedValue(new Error("database unavailable"));

    await expect(service.reply(USER, "Merhaba", MSG_ID)).rejects.toThrow(
      "database unavailable",
    );

    expect(usageAppend).toHaveBeenCalledOnce();
    expect(grant).toHaveBeenCalledWith(
      USER.id,
      Currency.COIN,
      5,
      expect.objectContaining({ refId: MSG_ID }),
    );
  });

  it("does not refund on idempotent retry when spend was already recorded", async () => {
    spend.mockResolvedValue({
      balance: { coinConfirmed: 5 },
      alreadySpent: true,
    });
    llmComplete.mockRejectedValue(new Error("LLM down"));

    await expect(service.reply(USER, "Tekrar", MSG_ID)).rejects.toThrow(
      "LLM down",
    );

    expect(spend).toHaveBeenCalledOnce();
    expect(grant).not.toHaveBeenCalled();
  });

  it("replays persisted history into the LLM call (USER→user, COACH→assistant)", async () => {
    lastN.mockResolvedValue([
      {
        id: "m1",
        role: "USER",
        content: "Önceki soru",
        sources: [],
        createdAt: "t",
      },
      {
        id: "m2",
        role: "COACH",
        content: "Önceki yanıt",
        sources: [],
        createdAt: "t",
      },
    ]);
    llmComplete.mockResolvedValue({
      text: "Yanıt",
      promptTokens: 1,
      completionTokens: 1,
      model: "fake",
    });

    await service.reply(USER, "Yeni soru", MSG_ID, CONV_ID);

    expect(llmComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        history: [
          { role: "user", content: "Önceki soru" },
          { role: "assistant", content: "Önceki yanıt" },
        ],
      }),
    );
  });

  it("grounds an article CTA directly without requiring an embedding", async () => {
    contextBuild.mockResolvedValue({ examType: "KPSS" });
    getInfoArticleSource.mockResolvedValue({
      title: "KPSS Başvuru Süreci",
      slug: "kpss-basvuru-sureci",
      sourceUrl: "https://www.osym.gov.tr",
      snippet: "Doğrulanmış başvuru içeriği",
    });
    llmComplete.mockResolvedValue({
      text: "Yanıt",
      promptTokens: 1,
      completionTokens: 1,
      model: "fake",
    });

    const result = await service.reply(
      USER,
      "Bu makaledeki onerileri aciklar misin?",
      MSG_ID,
      undefined,
      undefined,
      "kpss-basvuru-sureci",
    );

    expect(getInfoArticleSource).toHaveBeenCalledWith(
      "kpss-basvuru-sureci",
      "KPSS",
    );
    expect(llmEmbed).not.toHaveBeenCalled();
    expect(result.sources).toEqual([
      {
        title: "KPSS Başvuru Süreci",
        slug: "kpss-basvuru-sureci",
        url: "https://www.osym.gov.tr",
      },
    ]);
  });

  it("does not embed general coaching or emotional messages", async () => {
    contextBuild.mockResolvedValue({ examType: "KPSS" });
    llmComplete.mockResolvedValue({
      text: "Bugun kucuk bir adimla baslayabiliriz.",
      promptTokens: 1,
      completionTokens: 1,
      model: "fake",
    });

    await service.reply(USER, "Bugun cok kaygiliyim", MSG_ID);

    expect(llmEmbed).not.toHaveBeenCalled();
    expect(searchSimilarArticles).not.toHaveBeenCalled();
  });

  it("returns a verified countdown before budget, spend, or completion", async () => {
    contextBuild.mockResolvedValue({ examType: "KPSS" });
    getExamCalendarByFamily.mockResolvedValue({
      exam: { name: "KPSS Lisans 2026", family: "KPSS" },
      events: [
        {
          type: "EXAM_DATE",
          eventAt: "2026-09-06T00:00:00.000Z",
          source: "OSYM",
          sourceUrl: "https://www.osym.gov.tr",
        },
      ],
      examDateLabel: "6 Eylul 2026",
      daysRemaining: 48,
    });

    const result = await service.reply(USER, "KPSS sinavi ne zaman?", MSG_ID);

    expect(result).toMatchObject({
      reply: "coaching.official.EXAM_DATE",
      model: "verified-content",
      officialCountdown: {
        examType: "KPSS",
        examName: "KPSS Lisans 2026",
        daysRemaining: 48,
        examDateLabel: "6 Eylul 2026",
        source: "OSYM",
        sourceUrl: "https://www.osym.gov.tr",
      },
    });
    expect(result.reply).not.toContain("48");
    expect(llmComplete).not.toHaveBeenCalled();
    expect(llmEmbed).not.toHaveBeenCalled();
    expect(budgetAssert).not.toHaveBeenCalled();
    expect(spend).not.toHaveBeenCalled();
    expect(usageAppend).not.toHaveBeenCalled();
    expect(persistExchange).toHaveBeenCalledWith(
      USER.id,
      expect.objectContaining({ kind: "new" }),
      "KPSS sinavi ne zaman?",
      expect.objectContaining({
        model: "verified-content",
        officialCountdown: result.officialCountdown,
      }),
    );
  });

  it("embeds only the fixed official intent label and never calls completion", async () => {
    contextBuild.mockResolvedValue({ examType: "KPSS" });
    llmEmbed.mockResolvedValue([0.1]);
    searchSimilarArticles.mockResolvedValue([
      {
        title: "KPSS Basvuru Sureci",
        slug: "kpss-basvuru-sureci",
        sourceUrl: "https://www.osym.gov.tr",
        snippet: "verified",
      },
    ]);

    const result = await service.reply(
      USER,
      "Basvuru nasil yapiliyor?",
      MSG_ID,
    );

    expect(llmEmbed).toHaveBeenCalledWith("KPSS APPLICATION");
    expect(llmComplete).not.toHaveBeenCalled();
    expect(spend).not.toHaveBeenCalled();
    expect(usageAppend).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      reply: "coaching.official.APPLICATION",
      model: "verified-content",
      sources: [{ slug: "kpss-basvuru-sureci" }],
    });
  });
  it("returns safe copy when no verified official content is available", async () => {
    contextBuild.mockResolvedValue({ examType: null });

    const result = await service.reply(
      USER,
      "Basvuru nasil yapiliyor?",
      MSG_ID,
    );

    expect(result).toMatchObject({
      reply: "coaching.official.UNAVAILABLE",
      model: "verified-content",
      sources: [],
    });
    expect(llmEmbed).not.toHaveBeenCalled();
    expect(llmComplete).not.toHaveBeenCalled();
    expect(spend).not.toHaveBeenCalled();
    expect(usageAppend).not.toHaveBeenCalled();
  });

  it("uses the deterministic official resolver for SSE", async () => {
    contextBuild.mockResolvedValue({ examType: "KPSS" });
    getExamCalendarByFamily.mockResolvedValue({
      exam: { name: "KPSS", family: "KPSS" },
      events: [
        {
          type: "EXAM_DATE",
          source: "OSYM",
          sourceUrl: "https://www.osym.gov.tr",
        },
      ],
      examDateLabel: "6 Eylul 2026",
      daysRemaining: 48,
    });

    const events = [];
    for await (const event of service.replyStream(
      USER,
      "Sinava kac gun kaldi?",
      MSG_ID,
    )) {
      events.push(event);
    }

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      done: {
        model: "verified-content",
        officialCountdown: { daysRemaining: 48 },
      },
    });
    expect(llmCompleteStream).not.toHaveBeenCalled();
    expect(budgetAssert).not.toHaveBeenCalled();
    expect(spend).not.toHaveBeenCalled();
  });

  it("regenerates an official exchange without spend, usage, or completion", async () => {
    contextBuild.mockResolvedValue({ examType: "KPSS" });
    lastN.mockResolvedValue([
      {
        id: "m-user",
        role: "USER",
        content: "Basvuru nasil yapiliyor?",
        sources: [],
        createdAt: "t1",
      },
      {
        id: "m-coach",
        role: "COACH",
        content: "old",
        sources: [],
        createdAt: "t2",
      },
    ]);
    llmEmbed.mockResolvedValue([0.1]);
    searchSimilarArticles.mockResolvedValue([]);

    const events = [];
    for await (const event of service.regenerateStream(USER, CONV_ID))
      events.push(event);

    expect(events.at(-1)).toMatchObject({
      done: { model: "verified-content" },
    });
    expect(updateCoachReply).toHaveBeenCalledWith(
      USER.id,
      "m-coach",
      expect.objectContaining({ model: "verified-content" }),
    );
    expect(spend).not.toHaveBeenCalled();
    expect(usageAppend).not.toHaveBeenCalled();
    expect(llmCompleteStream).not.toHaveBeenCalled();
    expect(budgetAssert).not.toHaveBeenCalled();
  });

  it("does not emit an official regenerate reply when persistence loses the row", async () => {
    contextBuild.mockResolvedValue({ examType: "KPSS" });
    lastN.mockResolvedValue([
      {
        id: "m-user",
        role: "USER",
        content: "Basvuru nasil yapiliyor?",
        sources: [],
        createdAt: "t1",
      },
      {
        id: "m-coach",
        role: "COACH",
        content: "old",
        sources: [],
        createdAt: "t2",
      },
    ]);
    llmEmbed.mockResolvedValue([0.1]);
    searchSimilarArticles.mockResolvedValue([]);
    updateCoachReply.mockResolvedValue(false);

    const events: unknown[] = [];
    const consume = async () => {
      for await (const event of service.regenerateStream(USER, CONV_ID)) {
        events.push(event);
      }
    };

    await expect(consume()).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(events).toEqual([]);
    expect(spend).not.toHaveBeenCalled();
    expect(usageAppend).not.toHaveBeenCalled();
    expect(llmCompleteStream).not.toHaveBeenCalled();
  });

  it("persists the exchange only after a successful reply", async () => {
    llmComplete.mockResolvedValue({
      text: "Yanıt",
      promptTokens: 1,
      completionTokens: 1,
      model: "fake",
    });

    await service.reply(USER, "Merhaba", MSG_ID);

    expect(persistExchange).toHaveBeenCalledWith(
      USER.id,
      expect.objectContaining({ kind: "new" }),
      "Merhaba",
      {
      content: "Yanıt",
      model: "fake",
      sources: [],
    });
  });

  it("persists nothing when the LLM call fails", async () => {
    llmComplete.mockRejectedValue(new Error("LLM down"));

    await expect(service.reply(USER, "Merhaba", MSG_ID)).rejects.toThrow(
      "LLM down",
    );

    expect(persistExchange).not.toHaveBeenCalled();
  });

  it("streams deltas then a done event, persisting the exchange once", async () => {
    llmCompleteStream.mockImplementation(async function* () {
      yield { delta: "Merha" };
      yield { delta: "ba!" };
      yield {
        final: {
          text: "Merhaba!",
          promptTokens: 1,
          completionTokens: 1,
          model: "fake",
        },
      };
    });

    const events = [];
    for await (const ev of service.replyStream(USER, "Selam", MSG_ID))
      events.push(ev);

    expect(events).toEqual([
      { delta: "Merha" },
      { delta: "ba!" },
      {
        done: {
          reply: "Merhaba!",
          model: "fake",
          conversationId: CONV_ID,
          sources: [],
        },
      },
    ]);
    expect(persistExchange).toHaveBeenCalledOnce();
  });

  it("refunds coin and persists nothing when the stream fails mid-flight", async () => {
    llmCompleteStream.mockImplementation(async function* () {
      yield { delta: "Merha" };
      throw new Error("stream down");
    });

    const events: unknown[] = [];
    await expect(async () => {
      for await (const ev of service.replyStream(USER, "Selam", MSG_ID))
        events.push(ev);
    }).rejects.toThrow("stream down");

    expect(events).toEqual([{ delta: "Merha" }]);
    expect(grant).toHaveBeenCalledWith(
      USER.id,
      Currency.COIN,
      5,
      expect.objectContaining({ refId: MSG_ID }),
    );
    expect(persistExchange).not.toHaveBeenCalled();
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
    expect(res.suggestedTask).toEqual({
      title: "Tarih: 10 soru",
      subject: "Tarih",
    });
    expect(persistExchange).toHaveBeenCalledWith(
      USER.id,
      expect.objectContaining({ kind: "new" }),
      "Bana görev öner",
      {
        content: "Harika!",
        model: "fake",
        sources: [],
        suggestedTask: { title: "Tarih: 10 soru", subject: "Tarih" },
      },
    );
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
    expect(res.suggestedTask).toEqual({
      title: "Tarih: 10 soru",
      subject: "Tarih",
    });
    expect(persistExchange).toHaveBeenCalledWith(
      USER.id,
      expect.objectContaining({ kind: "new" }),
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
    for await (const ev of service.replyStream(USER, "görev", MSG_ID))
      events.push(ev);

    const streamedText = events
      .filter(
        (e): e is { delta: string } =>
          typeof (e as { delta?: string }).delta === "string",
      )
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
    llmComplete.mockResolvedValue({
      text: "Yanıt",
      promptTokens: 1,
      completionTokens: 1,
      model: "fake",
    });

    const res = await service.reply(
      USER,
      "Türkçe paragrafta zorlanıyorum",
      MSG_ID,
    );

    expect(persistExchange).toHaveBeenCalledWith(
      USER.id,
      { kind: "new", title: "Türkçe paragrafta zorlanıyorum" },
      "Türkçe paragrafta zorlanıyorum",
      expect.any(Object),
    );
    expect(res.conversationId).toBe(CONV_ID);
    expect(lastN).not.toHaveBeenCalled();
  });

  it("reuses an owned thread and does not create a new one", async () => {
    llmComplete.mockResolvedValue({
      text: "Yanıt",
      promptTokens: 1,
      completionTokens: 1,
      model: "fake",
    });
    const existing = "00000000-0000-4000-8000-0000000000c2";

    const res = await service.reply(USER, "Devam", MSG_ID, existing);

    expect(isOwned).toHaveBeenCalledWith(USER.id, existing);
    expect(res.conversationId).toBe(existing);
    expect(lastN).toHaveBeenCalledWith(USER.id, existing, expect.any(Number));
  });

  it("rejects a thread the user does not own", async () => {
    isOwned.mockResolvedValue(false);

    await expect(
      service.reply(
        USER,
        "Başkasının thread'i",
        MSG_ID,
        "00000000-0000-4000-8000-0000000000c9",
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(llmComplete).not.toHaveBeenCalled();
  });

  it("rejects a legacy empty thread instead of opening it as a usable chat", async () => {
    listPagedByConversation.mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 30,
      total: 0,
    });

    await expect(
      service.listConversationMessages(USER.id, CONV_ID, 1, 30),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
  it("still replies when history load fails (defensive)", async () => {
    lastN.mockRejectedValue(new Error("db down"));
    llmComplete.mockResolvedValue({
      text: "Yanıt",
      promptTokens: 1,
      completionTokens: 1,
      model: "fake",
    });

    const res = await service.reply(USER, "Merhaba", MSG_ID);

    expect(res.reply).toBe("Yanıt");
    expect(llmComplete).toHaveBeenCalledWith(
      expect.objectContaining({ history: [] }),
    );
  });
  it("loads an owned mock exam and adds only its safe authoritative summary to blocking chat", async () => {
    llmComplete.mockResolvedValue({
      text: "Yanıt",
      promptTokens: 1,
      completionTokens: 1,
      model: "fake",
    });

    await service.reply(
      USER,
      "Bu denemeyi yorumla",
      MSG_ID,
      undefined,
      MOCK_EXAM_ID,
    );

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
      service.reply(
        USER,
        "Bu denemeyi yorumla",
        MSG_ID,
        undefined,
        MOCK_EXAM_ID,
      ),
    ).rejects.toBe(notFound);
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
      yield {
        final: {
          text: "Yanıt",
          promptTokens: 1,
          completionTokens: 1,
          model: "fake",
        },
      };
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
      expect.objectContaining({
        system: expect.stringContaining("toplam net: 72.50"),
      }),
    );
  });

  // ---- regenerate ----

  const TAIL = [
    {
      id: "m-user",
      role: "USER",
      content: "Nasıl çalışmalıyım?",
      sources: [],
      feedback: null,
      createdAt: "t1",
    },
    {
      id: "m-coach",
      role: "COACH",
      content: "Eski yanıt.",
      sources: [],
      feedback: -1,
      createdAt: "t2",
    },
  ];

  it("regenerate overwrites the coach row in place — no new exchange, no memory trigger", async () => {
    lastN.mockResolvedValue(TAIL);
    llmCompleteStream.mockImplementation(async function* () {
      yield { delta: "Yeni yanıt." };
      yield {
        final: {
          text: "Yeni yanıt.",
          promptTokens: 1,
          completionTokens: 1,
          model: "fake",
        },
      };
    });

    const events: unknown[] = [];
    for await (const ev of service.regenerateStream(USER, CONV_ID))
      events.push(ev);

    expect(events.at(-1)).toMatchObject({
      done: { reply: "Yeni yanıt.", conversationId: CONV_ID },
    });
    expect(updateCoachReply).toHaveBeenCalledWith(
      USER.id,
      "m-coach",
      expect.objectContaining({ content: "Yeni yanıt.", model: "fake" }),
    );
    expect(persistExchange).not.toHaveBeenCalled();
    // The old (disliked) reply must not be replayed into the prompt history.
    expect(llmCompleteStream).toHaveBeenCalledWith(
      expect.objectContaining({ user: "Nasıl çalışmalıyım?", history: [] }),
    );
  });

  it("regenerate propagates persistence failure, refunds coin, and keeps usage", async () => {
    lastN.mockResolvedValue(TAIL);
    llmCompleteStream.mockImplementation(async function* () {
      yield { delta: "Yeni yanıt." };
      yield {
        final: {
          text: "Yeni yanıt.",
          promptTokens: 1,
          completionTokens: 1,
          model: "fake",
        },
      };
    });
    updateCoachReply.mockRejectedValue(new Error("database unavailable"));

    const consume = async () => {
      for await (const event of service.regenerateStream(USER, CONV_ID))
        void event;
    };
    await expect(consume()).rejects.toThrow("database unavailable");

    expect(usageAppend).toHaveBeenCalledOnce();
    expect(grant).toHaveBeenCalledWith(
      USER.id,
      Currency.COIN,
      5,
      expect.objectContaining({ refId: expect.any(String) }),
    );
  });
  it("regenerate rejects a missing coach row and refunds coin", async () => {
    lastN.mockResolvedValue(TAIL);
    llmCompleteStream.mockImplementation(async function* () {
      yield {
        final: {
          text: "Yeni yanıt.",
          promptTokens: 1,
          completionTokens: 1,
          model: "fake",
        },
      };
    });
    updateCoachReply.mockResolvedValue(false);

    const consume = async () => {
      for await (const event of service.regenerateStream(USER, CONV_ID))
        void event;
    };
    await expect(consume()).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(usageAppend).toHaveBeenCalledOnce();
    expect(grant).toHaveBeenCalledWith(
      USER.id,
      Currency.COIN,
      5,
      expect.objectContaining({ refId: expect.any(String) }),
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
