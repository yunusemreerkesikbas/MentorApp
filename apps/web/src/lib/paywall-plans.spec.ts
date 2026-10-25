import { describe, expect, it } from "vitest";
import { featuredPlanId, monthlyEquivalentMinor, savingsPercent } from "./paywall-plans";

const monthly = { id: "monthly", periodMonths: 1 };
const quarterly = { id: "quarterly", periodMonths: 3 };

describe("featuredPlanId", () => {
  it("recommends the longest period when there is a choice", () => {
    expect(featuredPlanId([monthly, quarterly])).toBe("quarterly");
    expect(featuredPlanId([quarterly, monthly])).toBe("quarterly");
  });

  it("recommends nothing without a real choice", () => {
    expect(featuredPlanId([])).toBeUndefined();
    expect(featuredPlanId([monthly])).toBeUndefined();
    expect(featuredPlanId([monthly, { id: "other", periodMonths: 1 }])).toBeUndefined();
  });
});

describe("savingsPercent", () => {
  const monthlyPlan = { periodMonths: 1, priceMinor: 24900 };
  const quarterlyPlan = { periodMonths: 3, priceMinor: 59900 };

  it("rounds the saving down so the badge never overclaims", () => {
    // 3 × 249 = 747, 599 saves 148 → 19.8%, shown as 19.
    expect(savingsPercent(quarterlyPlan, [monthlyPlan, quarterlyPlan])).toBe(19);
  });

  it("says nothing without a monthly plan or a real saving", () => {
    expect(savingsPercent(monthlyPlan, [monthlyPlan, quarterlyPlan])).toBeUndefined();
    expect(savingsPercent(quarterlyPlan, [quarterlyPlan])).toBeUndefined();
    expect(savingsPercent({ periodMonths: 3, priceMinor: 74700 }, [monthlyPlan])).toBeUndefined();
  });
});

describe("monthlyEquivalentMinor", () => {
  it("leaves a monthly price untouched", () => {
    expect(monthlyEquivalentMinor(24900, 1)).toBe(24900);
  });

  it("rounds a multi-month price to the nearest kuruş", () => {
    expect(monthlyEquivalentMinor(59900, 3)).toBe(19967);
    expect(monthlyEquivalentMinor(47920, 3)).toBe(15973);
  });
});
