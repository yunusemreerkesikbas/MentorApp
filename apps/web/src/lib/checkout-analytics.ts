import type { PlanDto } from "@mentor/types";
import type { ProductAnalyticsParams } from "./analytics";

export function buildBeginCheckoutParams(
  plan: PlanDto,
  chargedPriceMinor = plan.priceMinor,
): ProductAnalyticsParams["begin_checkout"] {
  const price = chargedPriceMinor / 100;
  return {
    currency: "TRY",
    value: price,
    items: [
      {
        item_id: plan.id,
        item_name: plan.name,
        item_category: "subscription",
        price,
        quantity: 1,
      },
    ],
  };
}
