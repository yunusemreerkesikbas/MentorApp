import { beforeEach, describe, expect, it, vi } from "vitest";
import { Currency } from "../../../packages/types/src/index";
import { FeatureFlag } from "../../../apps/api/src/common/config/config.catalog";
import { ChatService } from "../../../apps/api/src/modules/ai/application/chat.service";

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
const EMPTY_SNAPSHOT = {
  examType: null as string | null,
  dailyFocusGoalMinutes: null,
  moodLevel: null,
  moodTrend: "STABLE" as const,
  planCompletionRate: null,
  pendingAiCoachPlanTaskId: null,
  evidence: [],
};
const V2_TURN = {
  strategyVersion: "mentor-v2.1" as const,
  intent: "GENERAL" as const,
  tone: "WARM" as const,
  mode: "ANSWER" as const,
  usedEvidence: [],
  allowedAction: null,
  policy: {
    maxSentences: 4,
    humor: "NONE" as const,
    directness: "MEDIUM" as const,
  },
};
const EMPTY_PERSONALIZATION = {
  mode: "NEEDS_INPUT",
  examType: null,
  moodLevel: null,
  recentSessions: null,
  todayPlan: null,
  usedSignals: [],
  strategyVersion: "mentor-v2.1",
  intent: "GENERAL",
  tone: "WARM",
  usedEvidence: [],
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
  let getOrigin: ReturnType<typeof vi.fn>;
  let getMockExam: ReturnType<typeof vi.fn>;
  let contextBuild: ReturnType<typeof vi.fn>;
  let getInfoArticleSource: ReturnType<typeof vi.fn>;
  let searchSimilarArticles: ReturnType<typeof vi.fn>;
  let llmEmbed: ReturnType<typeof vi.fn>;
  let usageAppend: ReturnType<typeof vi.fn>;
  let getExamCalendarByFamily: ReturnType<typeof vi.fn>;
  let budgetAssert: ReturnType<typeof vi.fn>;
  let resolveForCoach: ReturnType<typeof vi.fn>;
  let tryGetBridge: ReturnType<typeof vi.fn>;
  let getRequestContext: ReturnType<typeof vi.fn>;
  let getCoachContext: ReturnType<typeof vi.fn>;
  let evidenceBuild: ReturnType<typeof vi.fn>;

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
    getOrigin = vi.fn(async () => null);
    getMockExam = vi.fn(async () => MOCK_EXAM);
    getCoachContext = vi.fn(async () => null);
    evidenceBuild = vi.fn(async () => EMPTY_SNAPSHOT);
    contextBuild = vi.fn(async () => ({
      examType: null,
    }));
    getInfoArticleSource = vi.fn();
    searchSimilarArticles = vi.fn();
    llmEmbed = vi.fn();

    usageAppend = vi.fn();
    getExamCalendarByFamily = vi.fn();
    budgetAssert = vi.fn(async () => undefined);
    resolveForCoach = vi.fn(async () => ({
      threadId: "11111111-1111-4111-8111-111111111111",
      intent: "PLAN",
      zoneType: "CHAT",
      tagSlug: "planlama",
      tagName: "Planlama",
    }));
    tryGetBridge = vi.fn(async () => null);
    getRequestContext = vi.fn(async () => null);
    const config = {
      get: vi.fn(async (key: string) => {
        if (key === FeatureFlag.AI_ENABLED) return true;
        if (key === FeatureFlag.ECONOMY_ENABLED) return true;
        if (key === "economy.coin.ai_chat_cost") return 5;
        if (key === "ai.chat.free_coin_daily_limit") return 5;
        if (key === "ai.coach.history_max_messages") return 10;
        if (key === "ai.coach.history_max_characters") return 6_000;
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
        getRequestContext,
      } as never,
      {
        isOwned,
        getOrigin,
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
      { build: evidenceBuild } as never,
      {
        getProfile: vi.fn(async () => ({
          calibrationStatus: "COMPLETED",
          memoryConsent: "DECLINED",
          supportPreference: null,
          directnessPreference: null,
          updatedAt: "2026-09-22T00:00:00.000Z",
        })),
        getPromptMemories: vi.fn(async () => []),
        learnFromChat: vi.fn(),
      } as never,
      { plan: vi.fn(() => V2_TURN) } as never,
      { getAccess: vi.fn(async () => ({ canChat: true })) } as never,
      { resolveForCoach, tryGetBridge } as never,
      undefined,
      { getCoachContext } as never,
    );
  });

  it("reproduces repeat completion with one Coin debit for the same clientMessageId", async () => {
    const refs = new Set<string>();
    let coin = 20;
    spend.mockImplementation(async (_user: string, cost: number, options: { refId: string }) => {
      const alreadySpent = refs.has(options.refId);
      if (!alreadySpent) { coin -= cost; refs.add(options.refId); }
      return { alreadySpent, balance: { coinConfirmed: coin } };
    });
    llmComplete.mockResolvedValue({ text: "Yanıt", promptTokens: 1, completionTokens: 1, model: "fake" });
    await service.reply(USER, "Türkçe paragrafta zorlanıyorum", MSG_ID);
    await service.reply(USER, "Matematik için çalışma önerisi", MSG_ID);
    expect(coin).toBe(15);
    expect(llmComplete).toHaveBeenCalledTimes(2);
    expect(persistExchange).toHaveBeenCalledTimes(2);
    console.log("REPRO: 2 successful AI completions and history writes; 1 debit of 5 Coin; reused clientMessageId.");
  });
});
