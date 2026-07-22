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

/** GET /v1/subscription response. */
export interface SubscriptionView {
  subscription: SubscriptionDto | null;
  entitlement: EntitlementDto;
}

/** POST /v1/subscription/checkout response. */
export interface CheckoutSession {
  checkoutUrl: string;
}
