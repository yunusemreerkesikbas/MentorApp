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

let autoOffersInFlight: Promise<PromotionOffersView | null> | null = null;

/**
 * The automatic (code-less) offer, deduped across parallel mounts — the dashboard banner, the
 * welcome dialog and the paywall all want it on the same render. Mirrors `fetchSubscriptionView`.
 *
 * Only CONCURRENT calls share a promise (`inFlight` is cleared in `finally`), so a later call —
 * e.g. after the user clears a coupon — still gets fresh prices. Resolves to null on failure:
 * every caller treats "no offer" as "show the list price", never as an error to surface.
 */
export function fetchAutoPromotionOffers(): Promise<PromotionOffersView | null> {
  autoOffersInFlight ??= fetchPromotionOffers()
    .catch(() => null)
    .finally(() => {
      autoOffersInFlight = null;
    });
  return autoOffersInFlight;
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

/**
 * The promotion to advertise on the dashboard banner, or null when there is nothing honest to say.
 *
 * Premium users are never shown a commercial nudge (same rule as `PremiumCampaignBanner` and the
 * ads placements). Only an offer with a REAL discount qualifies — a coded promotion the user has
 * not typed yet is the welcome dialog's job, not the banner's, so it is deliberately ignored here.
 */
export function pickBannerPromotion(
  offers: PromotionOffersView | null,
  isPremium: boolean,
): PromotionSummary | null {
  if (!offers || isPremium) return null;
  let best: { discountMinor: number; promotion: PromotionSummary } | null = null;
  for (const offer of Object.values(offers.offers)) {
    if (!offer.promotion || offer.discountMinor <= 0) continue;
    if (!best || offer.discountMinor > best.discountMinor) {
      best = { discountMinor: offer.discountMinor, promotion: offer.promotion };
    }
  }
  return best?.promotion ?? null;
}
