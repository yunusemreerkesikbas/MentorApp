import { describe, expect, it } from "vitest";
import { PromotionDiscountType } from "@mentor/types";
import { MIN_CHARGE_MINOR, computeDiscount } from "./promotion-price";

const MONTHLY = 24_900; // 249,00 ₺ — the seeded premium-monthly price
const NO_CAP = 90;

describe("computeDiscount", () => {
  it("applies a percentage discount", () => {
    expect(computeDiscount(MONTHLY, PromotionDiscountType.PERCENT, 20, NO_CAP)).toEqual({
      listPriceMinor: 24_900,
      discountMinor: 4_980,
      chargedPriceMinor: 19_920,
    });
  });

  it("rounds a fractional percentage to the nearest kuruş (single documented rule)", () => {
    // 999 * 15% = 149.85 → 150, never 149 and never a float reaching the provider.
    const result = computeDiscount(999, PromotionDiscountType.PERCENT, 15, NO_CAP);
    expect(result.discountMinor).toBe(150);
    expect(Number.isInteger(result.chargedPriceMinor)).toBe(true);
  });

  it("applies a fixed discount verbatim", () => {
    expect(computeDiscount(MONTHLY, PromotionDiscountType.FIXED, 5_000, NO_CAP)).toEqual({
      listPriceMinor: 24_900,
      discountMinor: 5_000,
      chargedPriceMinor: 19_900,
    });
  });

  it("caps a percentage discount at the configured maximum", () => {
    const result = computeDiscount(MONTHLY, PromotionDiscountType.PERCENT, 80, 50);
    expect(result.discountMinor).toBe(12_450); // 50%, not 80%
  });

  it("caps a FIXED discount at the same maximum (the cap must not be bypassable)", () => {
    const result = computeDiscount(MONTHLY, PromotionDiscountType.FIXED, 20_000, 50);
    expect(result.discountMinor).toBe(12_450);
  });

  it("never charges zero even at a 100% ceiling — that would skip e-Arşiv invoicing", () => {
    const result = computeDiscount(MONTHLY, PromotionDiscountType.FIXED, 99_999, 100);
    expect(result.chargedPriceMinor).toBe(MIN_CHARGE_MINOR);
    expect(result.discountMinor).toBe(MONTHLY - MIN_CHARGE_MINOR);
  });

  it("ignores a non-positive discount value", () => {
    expect(computeDiscount(MONTHLY, PromotionDiscountType.PERCENT, 0, NO_CAP).discountMinor).toBe(0);
    expect(computeDiscount(MONTHLY, PromotionDiscountType.FIXED, -5, NO_CAP).discountMinor).toBe(0);
  });

  it("keeps charged + discount === list for every input (the redemption CHECK constraint)", () => {
    const lists = [50, MIN_CHARGE_MINOR, 999, MONTHLY, 59_900];
    const values = [1, 15, 50, 90, 5_000, 99_999];
    for (const list of lists) {
      for (const value of values) {
        for (const type of [PromotionDiscountType.PERCENT, PromotionDiscountType.FIXED]) {
          const r = computeDiscount(list, type, value, NO_CAP);
          expect(r.chargedPriceMinor + r.discountMinor).toBe(list);
          expect(r.discountMinor).toBeGreaterThanOrEqual(0);
          expect(r.chargedPriceMinor).toBeGreaterThan(0);
        }
      }
    }
  });
});
