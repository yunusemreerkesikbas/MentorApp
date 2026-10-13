import type { PremiumFeatureId } from "@mentor/types";

export const PAYWALL_BENEFITS = ["coach", "daily", "analysis", "plan"] as const;
export type PaywallBenefit = (typeof PAYWALL_BENEFITS)[number];

/**
 * The benefit row a locked feature belongs to. A row exists only for what a student can reach on
 * the web today: `photo.categorize` has an API and no screen, coach-side features are not sold here.
 */
const FEATURE_BENEFIT: Partial<Record<PremiumFeatureId, PaywallBenefit>> = {
  "coach.chat": "coach",
  "daily.greeting": "daily",
  "mood.reflection": "daily",
  "session.reflection": "daily",
  "weekly.narration": "analysis",
  "deep.analysis": "analysis",
  "ghost.narration": "analysis",
  "plan.ai": "plan",
  "vision.note": "plan",
};

/** Rows in display order: the one the student just reached for comes first and is highlighted. */
export function orderPaywallBenefits(feature: PremiumFeatureId | undefined): {
  order: readonly PaywallBenefit[];
  highlighted: PaywallBenefit | undefined;
} {
  const highlighted = feature ? FEATURE_BENEFIT[feature] : undefined;
  if (!highlighted) return { order: PAYWALL_BENEFITS, highlighted };
  return {
    order: [highlighted, ...PAYWALL_BENEFITS.filter((benefit) => benefit !== highlighted)],
    highlighted,
  };
}
