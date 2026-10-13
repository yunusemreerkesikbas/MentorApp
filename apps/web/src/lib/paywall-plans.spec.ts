import { describe, expect, it } from "vitest";
import { featuredPlanId, monthlyEquivalentMinor } from "./paywall-plans";

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

describe("monthlyEquivalentMinor", () => {
  it("leaves a monthly price untouched", () => {
    expect(monthlyEquivalentMinor(24900, 1)).toBe(24900);
  });

  it("rounds a multi-month price to the nearest kuruş", () => {
    expect(monthlyEquivalentMinor(59900, 3)).toBe(19967);
    expect(monthlyEquivalentMinor(47920, 3)).toBe(15973);
  });
});
