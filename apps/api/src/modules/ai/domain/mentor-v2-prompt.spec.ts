import {
  CoachIntent,
  CoachTone,
  CoachTurnMode,
  CoachActionType,
  CoachEvidenceType,
  UserRole,
  type CoachMemoryFactDto,
} from "@mentor/types";
import {
  boundChatHistory,
  buildMentorV2Prompt,
  isMentorV2Enabled,
} from "./mentor-v2-prompt";

const turn = {
  strategyVersion: "mentor-v2.1" as const,
  intent: CoachIntent.PLAN,
  tone: CoachTone.WARM,
  mode: CoachTurnMode.ANSWER,
  usedEvidence: [
    {
      type: CoachEvidenceType.TODAY_PLAN,
      summary: "Bugünkü planın 1/3 tamamlandı.",
      observedAt: "2026-08-01T09:00:00.000Z",
    },
  ],
  allowedAction: CoachActionType.CREATE_PLAN_TASK,
  policy: {
    maxSentences: 5,
    humor: "NONE" as const,
    directness: "MEDIUM" as const,
  },
};

describe("Mentor V2 prompt", () => {
  it("injects only planner-selected evidence and structured memory", () => {
    const memories: CoachMemoryFactDto[] = [
      {
        id: "fact-1",
        key: "STUDY_TIME",
        value: "EVENING",
        source: "CHAT",
        expiresAt: null,
        createdAt: "2026-08-01T00:00:00.000Z",
        updatedAt: "2026-08-01T00:00:00.000Z",
      },
    ];
    const prompt = buildMentorV2Prompt({
      locale: "tr",
      turn,
      memories,
      memoryEnabled: true,
    });

    expect(prompt).toContain("mentor-yol arkadaşı");
    expect(prompt).toContain("Puhu değilsin");
    expect(prompt).toContain("Bugünkü planın 1/3 tamamlandı.");
    expect(prompt).toContain("STUDY_TIME=EVENING");
    expect(prompt).not.toContain("Son 28 günde");
    expect(prompt).toContain("<<MEMORY");
  });

  it("keeps Turkish and English personas separate", () => {
    const prompt = buildMentorV2Prompt({
      locale: "en",
      turn,
      memories: [],
      memoryEnabled: false,
    });
    expect(prompt).toContain("unnamed mentor-companion");
    expect(prompt).not.toContain("mentor-yol arkadaşı");
    expect(prompt).not.toContain("Sen Mentor");
    expect(prompt).not.toContain("<<MEMORY");
  });

  it("uses stable rollout buckets and always includes staff", () => {
    expect(isMentorV2Enabled("same-user", [], 0)).toBe(false);
    expect(isMentorV2Enabled("same-user", [UserRole.STAFF], 0)).toBe(true);
    expect(isMentorV2Enabled("same-user", [], 100)).toBe(true);
    expect(isMentorV2Enabled("same-user", [], 37)).toBe(
      isMentorV2Enabled("same-user", [], 37),
    );
  });

  it("bounds history by message count and character budget, preserving newest turns", () => {
    const history = [
      { role: "user" as const, content: "a".repeat(20) },
      { role: "assistant" as const, content: "b".repeat(20) },
      { role: "user" as const, content: "newest" },
    ];
    expect(boundChatHistory(history, 2, 25)).toEqual([
      { role: "user", content: "newest" },
    ]);
  });
});
