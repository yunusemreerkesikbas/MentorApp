import { describe, expect, it } from "vitest";
import type { PlanPreviewAccessDto } from "@mentor/types";
import { clockSuffix, planAccessView } from "./plan-coin-view";

const offer = (patch: Partial<PlanPreviewAccessDto> = {}): PlanPreviewAccessDto => ({
  mode: "COIN", canGenerate: true, cost: 200, dailyLimit: 1, dailyRemaining: 1, coinConfirmed: 320,
  latestRequestId: null, nextAvailableAt: null, ...patch,
});
const denied = (reason: string, patch: Partial<PlanPreviewAccessDto> = {}) =>
  offer({ canGenerate: false, reason, message: `msg:${reason}`, ...patch });

describe("planAccessView", () => {
  it("keeps Premium on the straight path and sends a locked free user to the paywall", () => {
    expect(planAccessView(offer({ mode: "INCLUDED", cost: null }), true)).toEqual({ kind: "wizard" });
    expect(planAccessView(denied("PAYMENT_PREMIUM_REQUIRED", { mode: "NONE", cost: null }), true))
      .toEqual({ kind: "paywall" });
  });

  it("lets affordable Coin lead with Premium as the quiet alternative", () => {
    expect(planAccessView(offer(), true)).toEqual({ kind: "choice", lead: "coin", coin: "ready", premium: true, missing: 0 });
    expect(planAccessView(offer(), false)).toMatchObject({ lead: "coin", premium: false });
  });

  it("puts Premium first when Coin is short or today's draft is used", () => {
    expect(planAccessView(denied("INSUFFICIENT_COIN", { coinConfirmed: 80 }), true))
      .toEqual({ kind: "choice", lead: "premium", coin: "short", premium: true, missing: 120 });
    expect(planAccessView(denied("AI_PLAN_COIN_LIMIT_REACHED", { dailyRemaining: 0 }), true))
      .toMatchObject({ lead: "premium", coin: "limit" });
  });

  it("draws no ledge when web purchases are off and Coin cannot pay", () => {
    expect(planAccessView(denied("INSUFFICIENT_COIN", { coinConfirmed: 80 }), false))
      .toMatchObject({ lead: null, coin: "short", premium: false });
  });

  it("offers a retry for passing outages on the Coin path and the server message otherwise", () => {
    for (const reason of ["AI_DISABLED", "AI_BUDGET_EXCEEDED"])
      expect(planAccessView(denied(reason), true)).toEqual({ kind: "retry" });
    expect(planAccessView(denied("AI_RATE_LIMITED"), true)).toEqual({ kind: "notice", message: "msg:AI_RATE_LIMITED" });
    expect(planAccessView(denied("AI_DISABLED", { mode: "INCLUDED", cost: null }), true))
      .toEqual({ kind: "notice", message: "msg:AI_DISABLED" });
  });
});

describe("clockSuffix", () => {
  it("follows how the time is read aloud", () => {
    const cases: Record<string, string> = {
      "21:40": "ta", "09:15": "te", "21:00": "de", "10:00": "da", "12:00": "de", "00:00": "da",
      "08:30": "da", "07:20": "de", "06:50": "de", "18:01": "de", "18:03": "te", "18:06": "da", "18:09": "da",
    };
    for (const [time, suffix] of Object.entries(cases)) expect(clockSuffix(time), time).toBe(suffix);
  });
});
