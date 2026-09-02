import {
  PromotionDiscountType,
  type PromotionOffersView,
  type PromotionSummary,
} from "@mentor/types";
import { http } from "@mentor/api-client";

/**
 * How big the discount is, written the same way on every surface.
 *
 * The figure is `summary.discountValue`, which the API clamps to what checkout will really apply,
 * so printing it is a promise the purchase keeps. For a FIXED campaign it is the worst case across
 * every plan the campaign covers, which is what makes it safe to state before a plan is chosen.
 *
 * `percent` is injected rather than formatted here because the percent sign sits on a different
 * side of the number per locale, and that shape already lives in the `paywall.discount_percent`
 * message. Currency is `Intl`'s job either way.
 */
export function formatPromotionMagnitude(
  promotion: PromotionSummary,
  locale: string,
  percent: (value: number) => string,
): string {
  if (promotion.discountType === PromotionDiscountType.PERCENT) {
    return percent(promotion.discountValue);
  }
  // Rounded DOWN, never to nearest: 124,50 TL rounded to nearest prints "125 TL off" and the
  // charge is 50 kurus smaller than advertised. Every other figure in this feature errs the same
  // way (the percent clamp, the worst-case across plans), so a stated discount is never bigger
  // than the applied one. Sub-lira discounts keep their kurus rather than collapsing to zero.
  const lira = Math.floor(promotion.discountValue / 100);
  const tag = locale === "en" ? "en-GB" : "tr-TR";
  return lira > 0
    ? lira.toLocaleString(tag, { style: "currency", currency: "TRY", maximumFractionDigits: 0 })
    : (promotion.discountValue / 100).toLocaleString(tag, {
        style: "currency",
        currency: "TRY",
        minimumFractionDigits: 2,
      });
}

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
 * The promotion worth interrupting the user with, or null when there is nothing new to say.
 *
 * A coded promotion wins: it is the one the user has to DO something about (type the code), so it
 * is the one worth a modal. A code-less promotion is already applied on the paywall and is
 * announced only when no coded one is waiting.
 *
 * `seen` holds campaign ids already shown on this device, so a second campaign gets its own single
 * appearance instead of being swallowed by a one-time flag. Copy comes entirely from the
 * promotion's own label — nothing about a specific campaign is hardcoded in the client.
 */
export function pickPromotionForDialog(
  offers: PromotionOffersView,
  seen: ReadonlySet<string>,
): PromotionSummary | null {
  const waiting = offers.available.find((promotion) => !seen.has(promotion.id));
  if (waiting) return waiting;
  return (
    Object.values(offers.offers)
      .map((offer) => offer.promotion)
      .find((promotion) => promotion != null && !seen.has(promotion.id)) ?? null
  );
}

/**
 * The promotion to advertise on the dashboard banner, or null when there is nothing honest to say.
 *
 * Premium users are never shown a commercial nudge (same rule as `PremiumCampaignBanner` and the
 * ads placements).
 *
 * Priority mirrors `pickPromotionForDialog` on purpose: a coded promotion wins, because it is the
 * one the user still has to act on. The two surfaces would otherwise disagree about which campaign
 * is "the" campaign — and the strip is where a dismissed modal leaves its campaign behind, so it
 * has to be able to carry a coded one at all. `available` is the API's list of coded promotions
 * this user already qualifies for, so advertising one is not a guess.
 */
export function pickBannerPromotion(
  offers: PromotionOffersView | null,
  isPremium: boolean,
): PromotionSummary | null {
  if (!offers || isPremium) return null;
  const waiting = offers.available[0];
  if (waiting) return waiting;
  let best: { discountMinor: number; promotion: PromotionSummary } | null = null;
  for (const offer of Object.values(offers.offers)) {
    if (!offer.promotion || offer.discountMinor <= 0) continue;
    if (!best || offer.discountMinor > best.discountMinor) {
      best = { discountMinor: offer.discountMinor, promotion: offer.promotion };
    }
  }
  return best?.promotion ?? null;
}
