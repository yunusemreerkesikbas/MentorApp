/**
 * Promotions contracts (W4) — shared by api (producer), web (paywall) and admin (CRUD).
 * Money is integer minor units (kuruş) — never float (engineering-principles §7).
 *
 * One primitive covers every commercial motion: a promotion with a `code` is a coupon the user
 * types; a promotion without one is applied automatically. Both resolve to the same offer shape.
 */

/** How a promotion decides whether a user qualifies. */
export const PromotionRuleType = {
  /** No condition — a plain seasonal campaign or a public coupon. */
  ANYONE: "ANYONE",
  /** Registered within `withinDays` and never subscribed before. */
  NEW_USER: "NEW_USER",
  /** At least `days` studied days inside the last `windowDays`. */
  ACTIVE_DAYS: "ACTIVE_DAYS",
  /** Previously subscribed, now EXPIRED or CANCELED. */
  WIN_BACK: "WIN_BACK",
} as const;
export type PromotionRuleType =
  (typeof PromotionRuleType)[keyof typeof PromotionRuleType];

export const PROMOTION_RULE_TYPES = [
  PromotionRuleType.ANYONE,
  PromotionRuleType.NEW_USER,
  PromotionRuleType.ACTIVE_DAYS,
  PromotionRuleType.WIN_BACK,
] as const satisfies readonly PromotionRuleType[];

export const PromotionDiscountType = {
  /** `discountValue` is a percentage, 1–90. */
  PERCENT: "PERCENT",
  /** `discountValue` is an absolute amount in kuruş. */
  FIXED: "FIXED",
} as const;
export type PromotionDiscountType =
  (typeof PromotionDiscountType)[keyof typeof PromotionDiscountType];

export const PromotionRedemptionStatus = {
  /** Checkout started: the price is agreed, the charge is not yet confirmed. Holds quota. */
  RESERVED: "RESERVED",
  /** Provider confirmed the checkout — the discount is live. */
  APPLIED: "APPLIED",
  /** Checkout abandoned or superseded — releases quota, keeps the audit trail. */
  VOIDED: "VOIDED",
} as const;
export type PromotionRedemptionStatus =
  (typeof PromotionRedemptionStatus)[keyof typeof PromotionRedemptionStatus];

/** Why no discount applies. Surfaced to the user only when they supplied a code. */
export type PromotionIneligibleReason =
  | "DISABLED"
  | "NOT_FOUND"
  | "NOT_STARTED"
  | "EXPIRED"
  | "PLAN_MISMATCH"
  | "RULE_UNMET"
  | "USER_LIMIT_REACHED"
  | "EXHAUSTED";

/** The user-facing half of a resolved promotion — enough to render the badge and the legal copy. */
export interface PromotionSummary {
  /**
   * Campaign identity, so a client can remember "already shown this one" across campaigns.
   * Inert on the wire: no endpoint accepts a promotion id — offers and checkout take a `code` —
   * so it grants nothing, it only lets the UI tell two campaigns apart.
   */
  id: string;
  /** null for an automatically applied promotion. */
  code: string | null;
  /** Localized badge text ("Hoş geldin hediyesi"). */
  label: string;
  /**
   * Per-campaign copy for the announcement modal, already localized. `null` means the campaign
   * left it blank and the client should use its own default wording.
   *
   * Only these two are admin-written. The scope line is derived from `planNames` and the CTA from
   * `code`, because a hand-written version of either could promise what checkout will not honour.
   */
  eyebrow: string | null;
  description: string | null;
  discountType: PromotionDiscountType;
  /**
   * The magnitude actually applied, NOT the admin's raw entry — percent for PERCENT, kuruş for
   * FIXED. `computeDiscount` clamps every discount against `promotions.max_percent` (the DB allows
   * 1..90, the ceiling defaults to 50), so advertising the raw value would promise a discount
   * checkout does not give. For FIXED this is the worst case across every plan the promotion
   * covers, so it stays true whichever plan the user picks.
   */
  discountValue: number;
  /**
   * Plans the promotion covers, by display name — `null` means every active plan.
   *
   * A promotion surface must never state a PRICE: it would presuppose a plan the user has not
   * chosen yet, and `planIds` can scope a campaign to one plan, which would make that price
   * simply wrong. Naming the scope is plan-count-proof; the paywall does the pricing.
   */
  planNames: string[] | null;
  /** How many charges the discount covers. 1 = the first charge only. */
  appliesToPeriods: number;
  endsAt: string | null;
}

/**
 * One plan's price after promotion resolution. `promotion: null` means the list price stands —
 * `chargedPriceMinor` then equals `listPriceMinor` and `discountMinor` is 0.
 */
export interface PromotionOfferView {
  planId: string;
  listPriceMinor: number;
  discountMinor: number;
  chargedPriceMinor: number;
  /** Price once the discount runs out. Equals `listPriceMinor` when there is no discount. */
  renewalPriceMinor: number;
  promotion: PromotionSummary | null;
  /** Set only when a supplied code was rejected — drives the coupon input's error message. */
  reason: PromotionIneligibleReason | null;
}

/** POST /v1/subscription/offers response. */
export interface PromotionOffersView {
  /** One entry per active plan, keyed by plan id. */
  offers: Record<string, PromotionOfferView>;
  /**
   * Coded promotions this user already qualifies for but has not typed yet — the "a coupon is
   * waiting for you" surface (welcome gift, earned reward). Empty when the caller supplied a code.
   * The code is data, never hardcoded in the client.
   */
  available: PromotionSummary[];
}
