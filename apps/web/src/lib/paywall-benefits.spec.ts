import { describe, expect, it } from "vitest";
import { PAYWALL_BENEFITS, orderPaywallBenefits } from "./paywall-benefits";

describe("orderPaywallBenefits", () => {
  it("keeps the default order with no highlight when no feature opened the paywall", () => {
    expect(orderPaywallBenefits(undefined)).toEqual({
      order: PAYWALL_BENEFITS,
      highlighted: undefined,
    });
  });

  it("lifts the row of the feature the student reached for", () => {
    expect(orderPaywallBenefits("session.reflection")).toEqual({
      order: ["daily", "coach", "analysis", "plan"],
      highlighted: "daily",
    });
    expect(orderPaywallBenefits("coach.chat").highlighted).toBe("coach");
    expect(orderPaywallBenefits("vision.note").order[0]).toBe("plan");
    expect(orderPaywallBenefits("ghost.narration").order[0]).toBe("analysis");
  });

  it("leaves the list untouched for a feature with no row", () => {
    for (const feature of ["mentorship.brief", "photo.categorize"] as const) {
      expect(orderPaywallBenefits(feature)).toEqual({
        order: PAYWALL_BENEFITS,
        highlighted: undefined,
      });
    }
  });
});
