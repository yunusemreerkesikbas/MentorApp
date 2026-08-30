import type { PromotionOffersView, PromotionSummary } from "@mentor/types";
import { http } from "@mentor/api-client";

/**
 * Per-plan price after promotions, plus any coded promotion the user already qualifies for.
 *
 * Omit `code` for the automatically applied offer; pass one to try a coupon. Advisory only —
 * checkout re-resolves and re-checks the quota under locks, so this can never grant a discount.
 * POST, not GET: a coupon attempt does not belong in a URL or a proxy cache.
 */
export function fetchPromotionOffers(code?: string): Promise<PromotionOffersView> {
  return http<PromotionOffersView>("/v1/subscription/offers", {
    method: "POST",
    body: JSON.stringify(code ? { code } : {}),
  });
}

/**
 * The promotion to announce in the welcome dialog, or null when there is nothing to celebrate.
 *
 * A coded promotion wins: it is the one the user has to DO something about (type the code), so it
 * is the one worth interrupting them for. A code-less promotion is already applied on the paywall,
 * and is announced only when no coded one is waiting. Either way the code and its label come from
 * the API — nothing about a specific campaign is hardcoded in the client.
 */
export function pickWelcomeGift(offers: PromotionOffersView): PromotionSummary | null {
  const waiting = offers.available[0];
  if (waiting) return waiting;
  return Object.values(offers.offers).find((offer) => offer.promotion)?.promotion ?? null;
}
