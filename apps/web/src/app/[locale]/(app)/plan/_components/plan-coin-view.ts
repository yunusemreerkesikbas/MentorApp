import type { PlanPreviewAccessDto } from "@mentor/types";

/** Outages that pass on their own: nothing was spent, so the sheet offers a retry. */
const PASSING = new Set(["AI_BUDGET_EXCEEDED", "AI_DISABLED"]);
const COIN_STATE: Record<string, "short" | "limit"> = {
  INSUFFICIENT_COIN: "short", AI_PLAN_COIN_LIMIT_REACHED: "limit",
};

/** Refusals of a Coin request that the choice sheet answers better than an error line. */
export const COIN_SHEET_ERRORS = new Set(["AI_PLAN_PRICE_CHANGED", "INSUFFICIENT_COIN", "AI_PLAN_COIN_LIMIT_REACHED"]);

const ONES = ["", "de", "de", "te", "te", "te", "da", "de", "de", "da"]; // bir iki üç dört beş altı yedi sekiz dokuz
const TENS = ["da", "da", "de", "da", "ta", "de"]; // sıfır on yirmi otuz kırk elli
/** Turkish locative suffix for a clock time as read aloud: "21:40" → "ta", "09:15" → "te", "21:00" → "de". */
export function clockSuffix(time: string): string {
  const [hour = 0, minute = 0] = time.split(/\D/).map(Number);
  const n = minute || hour;
  return n % 10 ? ONES[n % 10]! : TENS[n / 10]!;
}

export type PlanAccessView =
  | { kind: "wizard" } | { kind: "paywall" } | { kind: "retry" }
  | { kind: "notice"; message: string }
  | { kind: "choice"; lead: "coin" | "premium" | null; coin: "ready" | "short" | "limit"; premium: boolean; missing: number };

/**
 * What tapping "Koçla planla" opens (docs/plans/2026-11-03-coin-unlock-choice-design.md § Round 2):
 * Premium goes straight to the wizard; on the Coin path the choice sheet comes first.
 */
export function planAccessView(offer: PlanPreviewAccessDto, purchases: boolean): PlanAccessView {
  if (offer.mode !== "COIN") {
    if (offer.canGenerate) return { kind: "wizard" };
    if (offer.reason === "PAYMENT_PREMIUM_REQUIRED") return { kind: "paywall" };
    return { kind: "notice", message: offer.message ?? "" };
  }
  if (offer.reason && PASSING.has(offer.reason)) return { kind: "retry" };
  const coin = offer.reason ? COIN_STATE[offer.reason] : "ready";
  if (!coin) return { kind: "notice", message: offer.message ?? "" };
  return { kind: "choice", lead: coin === "ready" ? "coin" : purchases ? "premium" : null, coin, premium: purchases,
    missing: Math.max(0, (offer.cost ?? 0) - offer.coinConfirmed) };
}
