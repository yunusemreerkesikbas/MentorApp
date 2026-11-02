import { describe, expect, it } from "vitest";
import type { WeeklyRecapOfferDto } from "@mentor/types";
import { recapAccessView } from "./weekly-recap-access-view";

const offer = (patch: Partial<WeeklyRecapOfferDto> = {}): WeeklyRecapOfferDto => ({
  enabled: true, examId: "exam", weekStart: "2026-10-19", endDate: "2026-10-25", ready: true, premium: false,
  mode: "COIN", canOpen: true, premiumAvailable: true, reportId: null, cost: 250, coinConfirmed: 320,
  coinLimit: 2, coinRemaining: 2, windowDays: 30, nextAvailableAt: null,
  teaser: { activeDays: 5, focusMinutes: 340, topSubject: "Matematik" }, ...patch,
});
const denied = (reason: string, patch: Partial<WeeklyRecapOfferDto> = {}) =>
  offer({ canOpen: false, reason, message: `msg:${reason}`, ...patch });

describe("recapAccessView", () => {
  it("gives single-path states their own card", () => {
    expect(recapAccessView(offer({ mode: "EARNED", cost: 0 }), true)).toEqual({ kind: "gift" });
    expect(recapAccessView(offer({ mode: "PREMIUM", premium: true, premiumAvailable: false }), true)).toEqual({ kind: "member" });
    expect(recapAccessView(offer({ mode: "OWNED", reportId: "r" }), true)).toEqual({ kind: "owned" });
  });

  it("lets affordable Coin lead with Premium as the quiet alternative", () => {
    expect(recapAccessView(offer(), true)).toEqual({ kind: "choice", lead: "coin", coin: "ready", premium: true, missing: 0 });
    expect(recapAccessView(offer(), false)).toMatchObject({ lead: "coin", premium: false });
  });

  it("puts Premium first when Coin is short or the allowance is used", () => {
    expect(recapAccessView(denied("INSUFFICIENT_COIN", { coinConfirmed: 80 }), true))
      .toEqual({ kind: "choice", lead: "premium", coin: "short", premium: true, missing: 170 });
    expect(recapAccessView(denied("WEEKLY_RECAP_LIMIT_REACHED", { coinRemaining: 0 }), true))
      .toMatchObject({ lead: "premium", coin: "limit" });
  });

  it("draws no ledge when web purchases are off and Coin cannot open", () => {
    expect(recapAccessView(denied("INSUFFICIENT_COIN", { coinConfirmed: 80 }), false))
      .toMatchObject({ lead: null, coin: "short", premium: false });
  });

  it("drops the Coin row when Coin is off, and falls back to the server message with no path", () => {
    expect(recapAccessView(denied("PAYMENT_PREMIUM_REQUIRED"), true)).toMatchObject({ lead: "premium", coin: null });
    expect(recapAccessView(denied("PAYMENT_PREMIUM_REQUIRED"), false))
      .toEqual({ kind: "notice", message: "msg:PAYMENT_PREMIUM_REQUIRED" });
  });

  it("offers a retry for passing outages on every path, and a notice for a week that is not ready", () => {
    for (const reason of ["AI_BUDGET_EXCEEDED", "AI_DISABLED", "WEEKLY_RECAP_PROCESSING"])
      for (const mode of ["COIN", "EARNED", "PREMIUM"] as const)
        expect(recapAccessView(denied(reason, { mode }), true)).toEqual({ kind: "retry" });
    expect(recapAccessView(denied("COACHING_WEEKLY_REVIEW_INSUFFICIENT", { ready: false, premiumAvailable: false }), true))
      .toEqual({ kind: "notice", message: "msg:COACHING_WEEKLY_REVIEW_INSUFFICIENT" });
  });
});
