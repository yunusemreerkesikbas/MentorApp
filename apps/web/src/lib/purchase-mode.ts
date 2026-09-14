import type { PlanDto } from "@mentor/types";
import { optionalUrl } from "./profile-links";

/**
 * The one buying control a screen shows for the plans it lists. The backend decides per plan
 * (`purchaseEnabled`, `redirectToMobile`); nothing here re-derives a channel flag.
 */
export type PurchaseMode = "checkout" | "store" | "unavailable";

export interface StoreLinks {
  appStore: string | null;
  playStore: string | null;
}

/** NEXT_PUBLIC values are inlined at build time: a changed store URL needs a rebuild. */
export function getStoreLinks(): StoreLinks {
  return {
    appStore: optionalUrl(process.env.NEXT_PUBLIC_APP_STORE_URL),
    playStore: optionalUrl(process.env.NEXT_PUBLIC_PLAY_STORE_URL),
  };
}

export function purchaseMode(
  plans: readonly Pick<PlanDto, "purchaseEnabled" | "redirectToMobile">[],
  links: StoreLinks,
): PurchaseMode {
  if (plans.some((plan) => plan.purchaseEnabled)) return "checkout";
  // A hand-off with no store link configured would be a dead end, so it reads as "coming soon".
  if (plans.some((plan) => plan.redirectToMobile) && (links.appStore || links.playStore)) {
    return "store";
  }
  return "unavailable";
}

/** A coach buys seat plans and a student buys student plans; neither is shown the other's. */
export function plansForAudience<T extends Pick<PlanDto, "seatCount">>(
  plans: readonly T[],
  coach: boolean,
): T[] {
  return plans.filter((plan) => (plan.seatCount > 0) === coach);
}
