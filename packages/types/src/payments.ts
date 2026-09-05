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

/**
 * `subscriptions.provider` for a coach-sponsored seat (W8).
 *
 * Not a payment provider at all — no checkout, no webhook, no ledger row. It marks the rows that
 * three counters must skip: trial-once (`hasAnyForUser`), the paying/conversion metrics, and the
 * "you already have a subscription" guard on checkout. Getting premium from a coach must not spend
 * the student's own trial, must not inflate conversion, and must not block them from paying for
 * themselves whenever they want to.
 */
export const SUBSCRIPTION_PROVIDER_SPONSOR = "SPONSOR";

/** The plan a sponsored seat points at. Priced 0; it exists so the FK has somewhere to land. */
export const COACH_SEAT_PLAN_ID = "coach-seat";

export interface PlanDto {
  id: string;
  name: string;
  periodMonths: number;
  /** VAT-inclusive price in kuruş (e.g. 24900 = 249,00 ₺). */
  priceMinor: number;
  currency: "TRY";
  trialDays: number;
  /**
   * Sponsored coach seats this plan grants (W8). 0 on every student plan — a non-zero value is
   * what makes it a coach plan, and the catalog hides those until seat billing is switched on.
   */
  seatCount: number;
  /** Backend-owned availability; false while the real payment provider is not active. */
  purchaseEnabled: boolean;
}

export interface SubscriptionDto {
  id: string;
  planId: string;
  status: SubscriptionStatus;
  /** Subscription row createdAt — first checkout. */
  startedAt: string;
  trialEndsAt: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  /**
   * True when a coach's seat is paying for this, not the user (W8).
   *
   * The subscription screen has to know: a sponsored seat has no card, no renewal date and no
   * cancel button, and rendering it with the usual billing chrome would tell the user something
   * false about their own money. It also ends when the coaching link does, not on a period
   * boundary, so "renews on the 5th" would be wrong twice over.
   */
  sponsored: boolean;
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
  /**
   * The coach's AI brief over a student's report (W8). The only feature in this catalog whose
   * ACTOR and SUBJECT differ: the coach asks, the coach's quota is charged, the coach's roles
   * decide access — the student's tier is irrelevant to it.
   */
  MENTORSHIP_BRIEF: "mentorship.brief",
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
  PremiumFeatureId.MENTORSHIP_BRIEF,
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

/**
 * The promotion still covering this subscription's charges. Prices are the ones frozen at
 * checkout, so the screen shows what the user actually agreed to pay — not the current list price.
 */
export interface SubscriptionDiscountDto {
  listPriceMinor: number;
  discountMinor: number;
  chargedPriceMinor: number;
  /** Charges still covered. After that the plan renews at `listPriceMinor`. */
  periodsRemaining: number;
}

/** GET /v1/subscription response. */
export interface SubscriptionView {
  subscription: SubscriptionDto | null;
  entitlement: EntitlementDto;
  features: Record<PremiumFeatureId, FeaturePolicyDto>;
  /** null when the subscription pays the list price. */
  discount: SubscriptionDiscountDto | null;
}

/** POST /v1/subscription/checkout response. */
export interface CheckoutSession {
  checkoutUrl: string;
}

/**
 * Coach-sponsored Premium, as the operator sees it (W8 seats).
 *
 * The point of this DTO is one number: `costPerSeatMicros30d`. `mentorship.coach.free_seats` is
 * documented as the knob that bounds the whole giveaway, and until this existed there was no way
 * to tell whether the value it is set to is generous, stingy or ruinous.
 */
export interface AdminSponsorshipStatsDto {
  /** Live sponsored seats (non-terminal `provider = 'SPONSOR'` rows). */
  seats: number;
  /** `mentorship.coach.free_seats`, echoed so the setting sits next to its effect. */
  freeSeatsPerCoach: number;
  /** Whether sponsorship is switched on at all; `seats` can be non-zero while it is off. */
  sponsorshipEnabled: boolean;
  /** LLM spend by the sponsored cohort, micro-USD. */
  costMicros: { d1: number; d7: number; d30: number };
  /** 30-day cost divided by live seats. Null when there are no seats — not zero. */
  costPerSeatMicros30d: number | null;
  /**
   * True when the cohort was larger than the metric's own ceiling, so the costs above undercount.
   * Surfaced rather than swallowed: a quietly partial average is worse than a flagged one.
   */
  truncated: boolean;
  generatedAt: string;
}
