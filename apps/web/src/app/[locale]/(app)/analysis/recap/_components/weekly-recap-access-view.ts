import type { WeeklyRecapOfferDto } from "@mentor/types";

/** Outages that pass on their own: nothing was spent, so the card offers a retry. */
const PASSING = new Set(["AI_BUDGET_EXCEEDED", "AI_DISABLED", "WEEKLY_RECAP_PROCESSING"]);
const COIN_STATE: Record<string, "short" | "limit" | null> = {
  INSUFFICIENT_COIN: "short", WEEKLY_RECAP_LIMIT_REACHED: "limit", PAYMENT_PREMIUM_REQUIRED: null,
};

export type RecapAccessView =
  | { kind: "gift" } | { kind: "member" } | { kind: "owned" } | { kind: "retry" }
  | { kind: "notice"; message: string }
  | { kind: "choice"; lead: "coin" | "premium" | null; coin: "ready" | "short" | "limit" | null; premium: boolean; missing: number };

/**
 * The locked card for one offer (docs/plans/2026-11-03-coin-unlock-choice-design.md § States):
 * affordable Coin leads, otherwise Premium leads when it can be bought, otherwise nothing does.
 */
export function recapAccessView(offer: WeeklyRecapOfferDto, purchases: boolean): RecapAccessView {
  if (offer.reason && PASSING.has(offer.reason)) return { kind: "retry" };
  const notice = { kind: "notice", message: offer.message ?? "" } as const;
  if (offer.mode !== "COIN") {
    if (!offer.canOpen) return notice;
    return offer.mode === "EARNED" ? { kind: "gift" } : offer.mode === "PREMIUM" ? { kind: "member" } : { kind: "owned" };
  }
  if (offer.reason && !(offer.reason in COIN_STATE)) return notice;
  const coin = offer.reason ? COIN_STATE[offer.reason]! : "ready";
  const premium = purchases && offer.premiumAvailable;
  if (!coin && !premium) return notice;
  return { kind: "choice", lead: coin === "ready" ? "coin" : premium ? "premium" : null, coin, premium,
    missing: Math.max(0, offer.cost - offer.coinConfirmed) };
}
