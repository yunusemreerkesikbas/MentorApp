import {
  CoachActionType,
  CoachDirectnessPreference,
  CoachEvidenceType,
  CoachIntent,
  CoachSupportPreference,
  CoachTone,
  CoachTurnMode,
  type CoachActionType as CoachActionTypeValue,
  type CoachProfileDto,
  type CoachUsedEvidenceDto,
} from "@mentor/types";
import { hasSeriousDistressSignal } from "./serious-distress";

export const COACH_STRATEGY_VERSION = "mentor-v2.1";

export interface CoachTurnPlanInput {
  message: string;
  profile: CoachProfileDto;
  moodLevel: number | null;
  availableEvidence: CoachUsedEvidenceDto[];
  pendingAiCoachPlanTaskId?: string | null;
}

export interface CoachTurnPlan {
  strategyVersion: typeof COACH_STRATEGY_VERSION;
  intent: CoachIntent;
  tone: CoachTone;
  mode: CoachTurnMode;
  usedEvidence: CoachUsedEvidenceDto[];
  allowedAction: CoachActionTypeValue | null;
  policy: {
    maxSentences: number;
    humor: "NONE" | "LIGHT";
    directness: "LOW" | "MEDIUM" | "HIGH";
  };
}

const INTENT_EVIDENCE: Record<CoachIntent, readonly CoachEvidenceType[]> = {
  [CoachIntent.CHECK_IN]: [
    CoachEvidenceType.MOOD,
    CoachEvidenceType.TODAY_FOCUS,
    CoachEvidenceType.RECENT_RHYTHM,
  ],
  [CoachIntent.PLAN]: [
    CoachEvidenceType.TODAY_PLAN,
    CoachEvidenceType.TODAY_FOCUS,
    CoachEvidenceType.RECENT_RHYTHM,
    CoachEvidenceType.LONG_TERM_RHYTHM,
    CoachEvidenceType.ACTION_OUTCOME,
  ],
  [CoachIntent.FOCUS]: [
    CoachEvidenceType.TODAY_FOCUS,
    CoachEvidenceType.RECENT_RHYTHM,
    CoachEvidenceType.TODAY_PLAN,
  ],
  [CoachIntent.PROCRASTINATION]: [
    CoachEvidenceType.TODAY_PLAN,
    CoachEvidenceType.RECENT_RHYTHM,
    CoachEvidenceType.STREAK,
    CoachEvidenceType.ACTION_OUTCOME,
  ],
  [CoachIntent.ANXIETY]: [
    CoachEvidenceType.MOOD,
    CoachEvidenceType.RECENT_RHYTHM,
    CoachEvidenceType.TODAY_PLAN,
  ],
  [CoachIntent.PERFORMANCE]: [
    CoachEvidenceType.MOCK_PERFORMANCE,
    CoachEvidenceType.LONG_TERM_RHYTHM,
    CoachEvidenceType.RECENT_RHYTHM,
  ],
  [CoachIntent.GOAL]: [
    CoachEvidenceType.GOAL,
    CoachEvidenceType.LONG_TERM_RHYTHM,
    CoachEvidenceType.MOCK_PERFORMANCE,
  ],
  [CoachIntent.PROGRESS]: [
    CoachEvidenceType.MOCK_PERFORMANCE,
    CoachEvidenceType.STREAK,
    CoachEvidenceType.RECENT_RHYTHM,
    CoachEvidenceType.ACTION_OUTCOME,
  ],
  [CoachIntent.GENERAL]: [
    CoachEvidenceType.MOOD,
    CoachEvidenceType.RECENT_RHYTHM,
    CoachEvidenceType.TODAY_PLAN,
  ],
};

const includesAny = (message: string, phrases: readonly string[]) =>
  phrases.some((phrase) => message.includes(phrase));

export function classifyCoachIntent(message: string): CoachIntent {
  const normalized = message.normalize("NFKC").toLocaleLowerCase("tr-TR");
  if (
    includesAny(normalized, [
      "başard",
      "tamamlad",
      "hedefimi geç",
      "rekor",
      "ilerled",
      "improved",
      "completed",
      "proud",
    ])
  ) {
    return CoachIntent.PROGRESS;
  }
  if (
    includesAny(normalized, [
      "kayg",
      "panik",
      "kork",
      "yetişmeyecek",
      "endiş",
      "anxious",
      "panic",
      "worried",
    ])
  ) {
    return CoachIntent.ANXIETY;
  }
  if (
    includesAny(normalized, [
      "ertel",
      "başlayam",
      "kaçıyorum",
      "procrast",
      "putting off",
    ])
  ) {
    return CoachIntent.PROCRASTINATION;
  }
  if (
    includesAny(normalized, [
      "deneme",
      "net",
      "performans",
      "analiz",
      "mock exam",
      "score",
      "performance",
    ])
  ) {
    return CoachIntent.PERFORMANCE;
  }
  if (
    includesAny(normalized, [
      "hedef",
      "hayal",
      "üniversite",
      "meslek",
      "goal",
      "dream",
      "motivation",
      "motivasyon",
    ])
  ) {
    return CoachIntent.GOAL;
  }
  if (
    includesAny(normalized, [
      "plan",
      "ne çalış",
      "program",
      "bugün ne",
      "schedule",
      "what should i study",
    ])
  ) {
    return CoachIntent.PLAN;
  }
  if (
    includesAny(normalized, [
      "odak",
      "dikkat",
      "konsantre",
      "focus",
      "concentrat",
    ])
  ) {
    return CoachIntent.FOCUS;
  }
  if (
    includesAny(normalized, [
      "merhaba",
      "selam",
      "nasılsın",
      "bugün kötüyüm",
      "ruh hal",
      "modum",
      "mood",
      "hello",
      "how are you",
      "check in",
    ])
  ) {
    return CoachIntent.CHECK_IN;
  }
  return CoachIntent.GENERAL;
}

/** Pure deterministic decision layer. It never mutates data and never calls a model. */
export class CoachTurnPlanner {
  plan(input: CoachTurnPlanInput): CoachTurnPlan {
    const intent = classifyCoachIntent(input.message);
    if (hasSeriousDistressSignal(input.message)) {
      return this.result(
        intent,
        CoachTone.GENTLE,
        CoachTurnMode.SAFETY,
        [],
        null,
        {
          maxSentences: 4,
          humor: "NONE",
          directness: "LOW",
        },
      );
    }

    const shouldCalibrate =
      input.profile.calibrationStatus === "NOT_STARTED" &&
      (intent === CoachIntent.CHECK_IN || intent === CoachIntent.GENERAL);
    if (shouldCalibrate) {
      return this.result(
        intent,
        CoachTone.WARM,
        CoachTurnMode.CALIBRATE,
        [],
        null,
        {
          maxSentences: 2,
          humor: "NONE",
          directness: "LOW",
        },
      );
    }

    const tone = this.selectTone(input, intent);
    const usedEvidence = this.selectEvidence(
      input.availableEvidence,
      INTENT_EVIDENCE[intent],
    );
    const allowedAction = this.selectAction(
      intent,
      input.message,
      input.pendingAiCoachPlanTaskId ?? null,
    );
    return this.result(
      intent,
      tone,
      CoachTurnMode.ANSWER,
      usedEvidence,
      allowedAction,
      {
        maxSentences: tone === CoachTone.GENTLE ? 4 : 5,
        humor: tone === CoachTone.CELEBRATORY ? "LIGHT" : "NONE",
        directness:
          tone === CoachTone.GENTLE
            ? "LOW"
            : tone === CoachTone.DIRECT
              ? "HIGH"
              : "MEDIUM",
      },
    );
  }

  private selectTone(
    input: CoachTurnPlanInput,
    intent: CoachIntent,
  ): CoachTone {
    if (input.moodLevel !== null && input.moodLevel <= 2)
      return CoachTone.GENTLE;
    if (intent === CoachIntent.ANXIETY) return CoachTone.GENTLE;
    if (intent === CoachIntent.PROGRESS) return CoachTone.CELEBRATORY;
    if (intent === CoachIntent.PROCRASTINATION) return CoachTone.DIRECT;
    if (input.profile.supportPreference === CoachSupportPreference.EMOTIONAL) {
      return CoachTone.GENTLE;
    }
    if (
      input.profile.directnessPreference === CoachDirectnessPreference.DIRECT
    ) {
      return CoachTone.DIRECT;
    }
    return CoachTone.WARM;
  }

  private selectEvidence(
    available: CoachUsedEvidenceDto[],
    priority: readonly CoachEvidenceType[],
  ): CoachUsedEvidenceDto[] {
    const byType = new Map(available.map((item) => [item.type, item]));
    return priority.flatMap((type) => byType.get(type) ?? []).slice(0, 3);
  }

  private selectAction(
    intent: CoachIntent,
    message: string,
    pendingAiCoachPlanTaskId: string | null,
  ): CoachActionTypeValue | null {
    const normalized = message.normalize("NFKC").toLocaleLowerCase("tr-TR");
    if (
      pendingAiCoachPlanTaskId &&
      includesAny(normalized, [
        "başlayalım",
        "başlamak istiyorum",
        "seansı başlat",
        "çalışmaya başla",
        "start the session",
        "start studying",
      ])
    ) {
      return CoachActionType.START_PLAN_SESSION;
    }
    if (
      intent === CoachIntent.PLAN &&
      includesAny(normalized, [
        "çok ağır",
        "çok fazla",
        "çok yoğun",
        "planı uyarla",
        "planımı uyarla",
        "hafiflet",
        "overloaded",
        "adapt my plan",
        "too much",
      ])
    ) {
      return CoachActionType.OPEN_PLAN_ADAPTATION;
    }
    if (intent === CoachIntent.PLAN || intent === CoachIntent.PROCRASTINATION) {
      return CoachActionType.CREATE_PLAN_TASK;
    }
    if (intent === CoachIntent.PERFORMANCE) return CoachActionType.NAVIGATE;
    if (intent === CoachIntent.GOAL) return CoachActionType.NAVIGATE;
    if (
      intent === CoachIntent.CHECK_IN &&
      includesAny(normalized, ["ruh hal", "modum", "mood", "how i feel"])
    ) {
      return CoachActionType.NAVIGATE;
    }
    return null;
  }

  private result(
    intent: CoachIntent,
    tone: CoachTone,
    mode: CoachTurnMode,
    usedEvidence: CoachUsedEvidenceDto[],
    allowedAction: CoachActionTypeValue | null,
    policy: CoachTurnPlan["policy"],
  ): CoachTurnPlan {
    return {
      strategyVersion: COACH_STRATEGY_VERSION,
      intent,
      tone,
      mode,
      usedEvidence,
      allowedAction,
      policy,
    };
  }
}
