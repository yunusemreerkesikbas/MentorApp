import {
  CoachActionStatus,
  CoachActionType,
  CoachEvidenceType,
  CoachMemoryConsent,
  CoachSupportPreference,
} from "@mentor/types";
import { CoachTurnPlanner } from "../domain/coach-turn-planner";
import { ChatService } from "./chat.service";

const user = { id: "user-1", roles: [], orgId: null };
const persisted = {
  conversationId: "00000000-0000-4000-8000-000000000001",
  userMessageId: "00000000-0000-4000-8000-000000000002",
  coachMessageId: "00000000-0000-4000-8000-000000000003",
};

function makeService(
  calibrationStatus: "COMPLETED" | "NOT_STARTED" = "COMPLETED",
) {
  const complete = vi.fn(async () => ({
    text: 'Bugün tek bir matematik tekrarı seçelim. <<TASK{"title":"Matematik tekrar","subject":"Matematik"}>><<MEMORY{"key":"STUDY_TIME","value":"EVENING","sourceQuote":"Akşam çalışmak istiyorum"}>>',
    promptTokens: 20,
    completionTokens: 20,
    model: "gpt-5",
  }));
  const persistExchange = vi.fn(async () => persisted);
  const learnFromChat = vi.fn(async () => undefined);
  const budget = vi.fn(async () => undefined);
  const profile = {
    calibrationStatus,
    memoryConsent: CoachMemoryConsent.GRANTED,
    supportPreference: CoachSupportPreference.BALANCED,
    directnessPreference: "BALANCED" as const,
    updatedAt: new Date().toISOString(),
  };
  const profiles = {
    getProfile: vi.fn(async () => profile),
    getPromptMemories: vi.fn(async () => []),
    learnFromChat,
  };
  const evidence = {
    build: vi.fn(async () => ({
      examType: "YKS",
      dailyFocusGoalMinutes: 60,
      moodLevel: 3,
      moodTrend: "STABLE",
      planCompletionRate: 25,
      pendingAiCoachPlanTaskId: null,
      evidence: [
        {
          type: CoachEvidenceType.TODAY_PLAN,
          summary: "Bugünkü planın 1/4 tamamlandı.",
          observedAt: "2026-08-01T09:00:00.000Z",
        },
      ],
    })),
  };
  const service = new ChatService(
    { complete, completeStream: vi.fn(), embed: vi.fn() } as never,
    { build: vi.fn() } as never,
    { append: vi.fn(), countFeatureSince: vi.fn(async () => 0) } as never,
    {
      getInfoArticleSource: vi.fn(),
      getExamCalendarByFamily: vi.fn(async () => ({ exam: { id: "exam-1" } })),
      listExamSubjectsByExamId: vi.fn(async () => [
        { slug: "matematik", name: "Matematik" },
      ]),
    } as never,
    {
      get: vi.fn(async (key: string) => {
        if (key === "ai.enabled") return true;
        if (key === "ai.coach_personalization_v2.rollout_percent") return 100;
        if (key === "ai.coach.history_max_messages") return 10;
        if (key === "ai.coach.history_max_characters") return 6_000;
        if (key === "ai.chat.daily_limit") return 100;
        return 0;
      }),
    } as never,
    { getEntitlement: vi.fn(async () => ({ isPremium: true })) } as never,
    {} as never,
    {
      persistExchange,
      lastN: vi.fn(async () => []),
    } as never,
    { isOwned: vi.fn(async () => true) } as never,
    {} as never,
    { assertWithinBudget: budget } as never,
    { getById: vi.fn() } as never,
    {
      translate: vi.fn(
        (key: string) =>
          ({
            "coaching.mentorV2.createTask": "Plana ekle",
            "coaching.mentorV2.calibration": "Önce desteğin ritmini seçelim.",
            "coaching.mood.SERIOUS_DISTRESS": "Şimdi güvendiğin birine ulaş.",
          })[key] ?? key,
      ),
    } as never,
    undefined,
    evidence as never,
    profiles as never,
    new CoachTurnPlanner(),
  );
  return { service, complete, persistExchange, learnFromChat, budget };
}

describe("ChatService Mentor V2", () => {
  it("persists traceable evidence, one backend action, and a validated memory candidate", async () => {
    const { service, complete, learnFromChat } = makeService();
    const result = await service.reply(
      user,
      "Akşam çalışmak istiyorum, plan yapalım",
    );

    expect(complete).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining("Bugünkü planın 1/4 tamamlandı."),
      }),
    );
    expect(result).toMatchObject({
      coachMessageId: persisted.coachMessageId,
      personalization: {
        strategyVersion: "mentor-v2.1",
        intent: "PLAN",
        tone: "WARM",
      },
      action: { type: CoachActionType.CREATE_PLAN_TASK },
      actionStatus: CoachActionStatus.PROPOSED,
    });
    expect(learnFromChat).toHaveBeenCalledWith(
      user.id,
      persisted.userMessageId,
      "Akşam çalışmak istiyorum, plan yapalım",
      expect.objectContaining({ sourceQuote: "Akşam çalışmak istiyorum" }),
    );
  });

  it("returns serious-distress support before budget, entitlement, and the LLM", async () => {
    const { service, complete, budget } = makeService();
    const result = await service.reply(user, "Artık yaşamak istemiyorum");
    expect(result.model).toBe("verified-safety");
    expect(complete).not.toHaveBeenCalled();
    expect(budget).not.toHaveBeenCalled();
  });

  it("runs cold-start calibration locally without consuming quota", async () => {
    const { service, complete, budget } = makeService("NOT_STARTED");
    const result = await service.reply(user, "Merhaba");
    expect(result.model).toBe("mentor-calibration");
    expect(complete).not.toHaveBeenCalled();
    expect(budget).not.toHaveBeenCalled();
  });

  it("does not fail a persisted reply when optional memory learning is unavailable", async () => {
    const { service, learnFromChat } = makeService();
    learnFromChat.mockRejectedValueOnce(new Error("memory unavailable"));

    await expect(
      service.reply(user, "Akşam çalışmak istiyorum, plan yapalım"),
    ).resolves.toMatchObject({ coachMessageId: persisted.coachMessageId });
  });
});
