import {
  FeaturePolicyWindow,
  PremiumFeatureId,
  PREMIUM_FEATURE_IDS,
  type FeaturePolicyDto,
} from "@mentor/types";

const DAY_MS = 24 * 60 * 60 * 1000;

export const FEATURE_WINDOW_MS: Record<
  (typeof FeaturePolicyWindow)[keyof typeof FeaturePolicyWindow],
  number
> = {
  [FeaturePolicyWindow.DAY]: DAY_MS,
  [FeaturePolicyWindow.WEEK]: 7 * DAY_MS,
  [FeaturePolicyWindow.MONTH]: 30 * DAY_MS,
};

export interface PremiumFeatureMeta {
  window: FeaturePolicyDto["window"];
  enabledKey: `ai.features.${PremiumFeatureId}.free_enabled`;
  limitKey: `ai.features.${PremiumFeatureId}.free_limit`;
}

export const PREMIUM_FEATURE_CATALOG: Record<PremiumFeatureId, PremiumFeatureMeta> =
  {
    [PremiumFeatureId.MENTORSHIP_BRIEF]: {
      // DAY, like the other on-demand surfaces: a coach reviewing a student today should not be
      // rationed by what they read last week.
      window: FeaturePolicyWindow.DAY,
      enabledKey: "ai.features.mentorship.brief.free_enabled",
      limitKey: "ai.features.mentorship.brief.free_limit",
    },
    [PremiumFeatureId.COACH_CHAT]: {
      window: FeaturePolicyWindow.DAY,
      enabledKey: "ai.features.coach.chat.free_enabled",
      limitKey: "ai.features.coach.chat.free_limit",
    },
    [PremiumFeatureId.PHOTO_CATEGORIZE]: {
      window: FeaturePolicyWindow.MONTH,
      enabledKey: "ai.features.photo.categorize.free_enabled",
      limitKey: "ai.features.photo.categorize.free_limit",
    },
    [PremiumFeatureId.PLAN_AI]: {
      window: FeaturePolicyWindow.DAY,
      enabledKey: "ai.features.plan.ai.free_enabled",
      limitKey: "ai.features.plan.ai.free_limit",
    },
    [PremiumFeatureId.MOOD_REFLECTION]: {
      window: FeaturePolicyWindow.DAY,
      enabledKey: "ai.features.mood.reflection.free_enabled",
      limitKey: "ai.features.mood.reflection.free_limit",
    },
    [PremiumFeatureId.GHOST_NARRATION]: {
      window: FeaturePolicyWindow.DAY,
      enabledKey: "ai.features.ghost.narration.free_enabled",
      limitKey: "ai.features.ghost.narration.free_limit",
    },
    [PremiumFeatureId.VISION_NOTE]: {
      window: FeaturePolicyWindow.DAY,
      enabledKey: "ai.features.vision.note.free_enabled",
      limitKey: "ai.features.vision.note.free_limit",
    },
    [PremiumFeatureId.SESSION_REFLECTION]: {
      window: FeaturePolicyWindow.DAY,
      enabledKey: "ai.features.session.reflection.free_enabled",
      limitKey: "ai.features.session.reflection.free_limit",
    },
    [PremiumFeatureId.WEEKLY_NARRATION]: {
      window: FeaturePolicyWindow.WEEK,
      enabledKey: "ai.features.weekly.narration.free_enabled",
      limitKey: "ai.features.weekly.narration.free_limit",
    },
    [PremiumFeatureId.DAILY_GREETING]: {
      window: FeaturePolicyWindow.DAY,
      enabledKey: "ai.features.daily.greeting.free_enabled",
      limitKey: "ai.features.daily.greeting.free_limit",
    },
    [PremiumFeatureId.DEEP_ANALYSIS]: {
      window: FeaturePolicyWindow.WEEK,
      enabledKey: "ai.features.deep.analysis.free_enabled",
      limitKey: "ai.features.deep.analysis.free_limit",
    },
  };

export { PREMIUM_FEATURE_IDS };

export interface FeatureAccessInput {
  isPremium: boolean;
  freeEnabled: boolean;
  used: number;
  freeLimit: number;
}

export type FeatureAccessDecision =
  | { allowed: true }
  | { allowed: false; reason: "PAYMENT_PREMIUM_REQUIRED" };

/**
 * Binary entitlement stays on EntitlementService. This only decides whether a
 * free user may consume a capped taste of one premium surface.
 */
export function evaluateFeatureAccess(
  input: FeatureAccessInput,
): FeatureAccessDecision {
  if (input.isPremium) return { allowed: true };
  if (!input.freeEnabled) {
    return { allowed: false, reason: "PAYMENT_PREMIUM_REQUIRED" };
  }
  if (input.used >= input.freeLimit) {
    return { allowed: false, reason: "PAYMENT_PREMIUM_REQUIRED" };
  }
  return { allowed: true };
}
