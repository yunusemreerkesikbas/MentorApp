import { describe, expect, it } from "vitest";
import type { PlanDto } from "@mentor/types";
import { buildBeginCheckoutParams } from "./checkout-analytics";

const plan: PlanDto = {
  id: "premium-monthly",
  name: "Premium Aylık",
  periodMonths: 1,
  priceMinor: 24900,
  currency: "TRY",
  trialDays: 7,
  seatCount: 0,
  purchaseEnabled: true,
};

describe("buildBeginCheckoutParams", () => {
  it("uses the selected plan's resolved promotional charge", () => {
    expect(buildBeginCheckoutParams(plan, 14900)).toEqual({
      currency: "TRY",
      value: 149,
      items: [
        {
          item_id: "premium-monthly",
          item_name: "Premium Aylık",
          item_category: "subscription",
          price: 149,
          quantity: 1,
        },
      ],
    });
  });
});
