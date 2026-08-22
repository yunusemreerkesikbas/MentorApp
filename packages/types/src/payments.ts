/**
 * Payments contracts (W4) — shared by api (producer) and web/mobile (consumers).
 * Money is integer minor units (kuruş) — never float (engineering-principles §7).
 */
import type { SubscriptionTier } from "./index.js";

export const SubscriptionStatus = {
  /** Checkout started, provider payment not yet confirmed — grants NO premium (verification gate). */
  INCOMPLETE: "INCOMPLETE",
  TRIALING: "TRIALING",
  ACTIVE: "ACTIVE",
  /** Renewal failed — premium continues during the grace period (dunning §7). */
  PAST_DUE: "PAST_DUE",
  /** User canceled — access continues until period end, then EXPIRED. */
  CANCELED: "CANCELED",
  EXPIRED: "EXPIRED",
} as const;
export type SubscriptionStatus = (typeof SubscriptionStatus)[keyof typeof SubscriptionStatus];

export interface PlanDto {
  id: string;
  name: string;
  periodMonths: number;
  /** VAT-inclusive price in kuruş (e.g. 24900 = 249,00 ₺). */
  priceMinor: number;
  currency: "TRY";
  trialDays: number;
  /** Backend-owned availability; false while the real payment provider is not active. */
  purchaseEnabled: boolean;
}

export interface SubscriptionDto {
  id: string;
  planId: string;
  status: SubscriptionStatus;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

export interface EntitlementDto {
  tier: SubscriptionTier;
  isPremium: boolean;
  /** Premium valid until (incl. grace) — null for FREE. */
  validUntil: string | null;
  /** Machine reason: NONE | TRIALING | ACTIVE | GRACE | CANCELED_PERIOD | EXPIRED */
  reason: string;
}

/** Code-owned premium surfaces. Admins toggle free taste; they cannot invent ids. */
export const PremiumFeatureId = {
  COACH_CHAT: "coach.chat",
  PHOTO_CATEGORIZE: "photo.categorize",
  PLAN_AI: "plan.ai",
  MOOD_REFLECTION: "mood.reflection",
  GHOST_NARRATION: "ghost.narration",
  VISION_NOTE: "vision.note",
  SESSION_REFLECTION: "session.reflection",
  WEEKLY_NARRATION: "weekly.narration",
  DAILY_GREETING: "daily.greeting",
  DEEP_ANALYSIS: "deep.analysis",
} as const;
export type PremiumFeatureId =
  (typeof PremiumFeatureId)[keyof typeof PremiumFeatureId];

export const PREMIUM_FEATURE_IDS = [
  PremiumFeatureId.COACH_CHAT,
  PremiumFeatureId.PHOTO_CATEGORIZE,
  PremiumFeatureId.PLAN_AI,
  PremiumFeatureId.MOOD_REFLECTION,
  PremiumFeatureId.GHOST_NARRATION,
  PremiumFeatureId.VISION_NOTE,
  PremiumFeatureId.SESSION_REFLECTION,
  PremiumFeatureId.WEEKLY_NARRATION,
  PremiumFeatureId.DAILY_GREETING,
  PremiumFeatureId.DEEP_ANALYSIS,
] as const satisfies readonly PremiumFeatureId[];

export const FeaturePolicyWindow = {
  DAY: "day",
  WEEK: "week",
  MONTH: "month",
} as const;
export type FeaturePolicyWindow =
  (typeof FeaturePolicyWindow)[keyof typeof FeaturePolicyWindow];

/** Policy only — remaining quota is enforced on the action, not this DTO. */
export interface FeaturePolicyDto {
  id: PremiumFeatureId;
  freeEnabled: boolean;
  limit: number;
  window: FeaturePolicyWindow;
}

/** GET /v1/subscription response. */
export interface SubscriptionView {
  subscription: SubscriptionDto | null;
  entitlement: EntitlementDto;
  features: Record<PremiumFeatureId, FeaturePolicyDto>;
}

/** POST /v1/subscription/checkout response. */
export interface CheckoutSession {
  checkoutUrl: string;
}
