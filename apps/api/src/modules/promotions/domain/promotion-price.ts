import { PromotionDiscountType } from "@mentor/types";

/**
 * Floor for a discounted charge. A 0 ₺ charge would trip the `!event.amountMinor && !plan?.priceMinor`
 * guard in `SubscriptionsService.issueInvoiceSafely` and silently skip the e-Arşiv invoice, which
 * Turkish B2C rules do not allow. Clamping here keeps that branch unreachable for a discounted charge.
 */
export const MIN_CHARGE_MINOR = 100; // 1,00 ₺

export interface DiscountBreakdown {
  listPriceMinor: number;
  discountMinor: number;
  /** Always `listPriceMinor - discountMinor` — the `promotion_redemptions` CHECK relies on it. */
  chargedPriceMinor: number;
}

/**
 * The single place a discount becomes money (§7: integer minor units, never float).
 *
 * Rounds exactly once so we never drift a kuruş against the provider or the invoice, then clamps
 * twice: to `maxPercent` — which caps FIXED discounts too, otherwise an admin could bypass the
 * ceiling by switching the discount type — and to {@link MIN_CHARGE_MINOR}.
 */
export function computeDiscount(
  listPriceMinor: number,
  type: PromotionDiscountType,
  value: number,
  maxPercent: number,
): DiscountBreakdown {
  const raw =
    value > 0
      ? type === PromotionDiscountType.PERCENT
        ? Math.round((listPriceMinor * value) / 100)
        : Math.round(value)
      : 0;
  const ceiling = Math.round((listPriceMinor * maxPercent) / 100);
  const floor = Math.max(0, listPriceMinor - MIN_CHARGE_MINOR);
  const discountMinor = Math.max(0, Math.min(raw, ceiling, floor));
  return {
    listPriceMinor,
    discountMinor,
    chargedPriceMinor: listPriceMinor - discountMinor,
  };
}
