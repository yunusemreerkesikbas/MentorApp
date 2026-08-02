import {
  CoachActionType,
  CoachDirectnessPreference,
  CoachEvidenceType,
  CoachIntent,
  CoachMemoryConsent,
  CoachSupportPreference,
  CoachTone,
  CoachTurnMode,
  type CoachProfileDto,
  type CoachUsedEvidenceDto,
} from "@mentor/types";
import { CoachTurnPlanner } from "./coach-turn-planner";

const now = "2026-08-01T12:00:00.000Z";
const evidence = (
  type: CoachEvidenceType,
  summary: string,
): CoachUsedEvidenceDto => ({ type, summary, observedAt: now });

const profile: CoachProfileDto = {
  calibrationStatus: "COMPLETED",
  memoryConsent: CoachMemoryConsent.GRANTED,
  supportPreference: CoachSupportPreference.BALANCED,
  directnessPreference: CoachDirectnessPreference.BALANCED,
  updatedAt: now,
};

describe("CoachTurnPlanner", () => {
  const planner = new CoachTurnPlanner();

  it("routes serious distress to a deterministic safety turn before normal coaching", () => {
    const result = planner.plan({
      message: "Artık yaşamak istemiyorum",
      profile,
      moodLevel: 4,
      availableEvidence: [
        evidence(
          CoachEvidenceType.TODAY_PLAN,
          "Bugünkü planın 2/3 tamamlandı.",
        ),
      ],
    });

    expect(result).toMatchObject({
      mode: CoachTurnMode.SAFETY,
      tone: CoachTone.GENTLE,
      allowedAction: null,
      usedEvidence: [],
    });
  });

  it.each([
    [
      "Bugün çok kaygılıyım, yetişmeyecek gibi",
      CoachIntent.ANXIETY,
      CoachTone.GENTLE,
    ],
    [
      "Sürekli erteliyorum, beni toparla",
      CoachIntent.PROCRASTINATION,
      CoachTone.DIRECT,
    ],
    ["Bu hafta hedefimi geçtim", CoachIntent.PROGRESS, CoachTone.CELEBRATORY],
    ["Bugün ne çalışayım?", CoachIntent.PLAN, CoachTone.WARM],
  ] as const)("classifies %s", (message, intent, tone) => {
    expect(
      planner.plan({
        message,
        profile,
        moodLevel: null,
        availableEvidence: [],
      }),
    ).toMatchObject({ intent, tone, mode: CoachTurnMode.ANSWER });
  });

  it("lets a low mood soften an otherwise direct procrastination turn", () => {
    const result = planner.plan({
      message: "Yine erteledim",
      profile,
      moodLevel: 1,
      availableEvidence: [],
    });
    expect(result.tone).toBe(CoachTone.GENTLE);
    expect(result.policy.directness).toBe("LOW");
  });

  it("uses at most three intent-relevant evidence items and hides goals outside goal intent", () => {
    const availableEvidence = [
      evidence(CoachEvidenceType.TODAY_PLAN, "Bugünkü planın 1/3 tamamlandı."),
      evidence(
        CoachEvidenceType.RECENT_RHYTHM,
        "Son 7 günde 4 aktif günün var.",
      ),
      evidence(
        CoachEvidenceType.LONG_TERM_RHYTHM,
        "Son 28 günde 13 aktif günün var.",
      ),
      evidence(CoachEvidenceType.MOOD, "Bugünkü enerji sinyalin düşük."),
      evidence(CoachEvidenceType.GOAL, "Hedef alanın sağlık."),
    ];

    const plan = planner.plan({
      message: "Planımı toparlayalım",
      profile,
      moodLevel: 3,
      availableEvidence,
    });

    expect(plan.usedEvidence).toHaveLength(3);
    expect(plan.usedEvidence.map((item) => item.type)).not.toContain(
      CoachEvidenceType.GOAL,
    );

    const goal = planner.plan({
      message: "Hedefime ulaşmak için motivasyonum düştü",
      profile,
      moodLevel: 3,
      availableEvidence,
    });
    expect(goal.usedEvidence.map((item) => item.type)).toContain(
      CoachEvidenceType.GOAL,
    );
  });

  it("asks one calibration question without an LLM turn when setup is incomplete", () => {
    const result = planner.plan({
      message: "Merhaba",
      profile: { ...profile, calibrationStatus: "NOT_STARTED" },
      moodLevel: null,
      availableEvidence: [],
    });
    expect(result).toMatchObject({
      mode: CoachTurnMode.CALIBRATE,
      allowedAction: null,
      usedEvidence: [],
    });
  });

  it.each([
    [
      "Bugünkü plan çok ağır, planımı hafiflet",
      null,
      CoachActionType.OPEN_PLAN_ADAPTATION,
    ],
    [
      "Önerdiğin göreve başlayalım",
      "00000000-0000-4000-8000-000000000010",
      CoachActionType.START_PLAN_SESSION,
    ],
    ["Ruh halime bakalım", null, CoachActionType.NAVIGATE],
  ] as const)(
    "selects one backend action for %s",
    (message, pendingAiCoachPlanTaskId, expected) => {
      const result = planner.plan({
        message,
        profile,
        moodLevel: null,
        availableEvidence: [],
        pendingAiCoachPlanTaskId,
      });

      expect(result.allowedAction).toBe(expected);
    },
  );

  it("does not offer a start action without an owned pending task candidate", () => {
    const result = planner.plan({
      message: "Önerdiğin göreve başlayalım",
      profile,
      moodLevel: null,
      availableEvidence: [],
      pendingAiCoachPlanTaskId: null,
    });

    expect(result.allowedAction).toBeNull();
  });
});
