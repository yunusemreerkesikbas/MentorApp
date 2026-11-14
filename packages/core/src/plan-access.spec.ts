import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PlanPreviewAccessDto, SubscriptionView } from "@mentor/types";
import { clockSuffix, isPremiumFeatureAvailable, planAccessView } from "../dist/index.js";

const offer = (patch: Partial<PlanPreviewAccessDto> = {}): PlanPreviewAccessDto => ({
  mode: "COIN", canGenerate: true, cost: 200, dailyLimit: 1, dailyRemaining: 1, coinConfirmed: 320,
  latestRequestId: null, nextAvailableAt: null, ...patch,
});
const denied = (reason: string, patch: Partial<PlanPreviewAccessDto> = {}) =>
  offer({ canGenerate: false, reason, message: `msg:${reason}`, ...patch });

describe("planAccessView", () => {
  it("keeps Premium on the straight path and sends a locked free user to the paywall", () => {
    assert.deepEqual(planAccessView(offer({ mode: "INCLUDED", cost: null }), true), { kind: "wizard" });
    assert.deepEqual(planAccessView(denied("PAYMENT_PREMIUM_REQUIRED", { mode: "NONE", cost: null }), false), {
      kind: "paywall",
    });
  });

  it("lets affordable Coin lead, with Premium only when purchases are on", () => {
    assert.deepEqual(planAccessView(offer(), true), { kind: "choice", lead: "coin", coin: "ready", premium: true, missing: 0 });
    assert.deepEqual(planAccessView(offer(), false), { kind: "choice", lead: "coin", coin: "ready", premium: false, missing: 0 });
  });

  it("draws no lead when purchases are off and Coin cannot pay", () => {
    assert.deepEqual(planAccessView(denied("INSUFFICIENT_COIN"), false), {
      kind: "choice", lead: null, coin: "short", premium: false, missing: 0,
    });
    assert.deepEqual(planAccessView(denied("INSUFFICIENT_COIN", { coinConfirmed: 150 }), false), {
      kind: "choice", lead: null, coin: "short", premium: false, missing: 50,
    });
    assert.equal((planAccessView(denied("AI_PLAN_COIN_LIMIT_REACHED", { dailyRemaining: 0 }), false) as { coin: string }).coin, "limit");
  });

  it("offers a retry for passing outages on the Coin path and the server message otherwise", () => {
    for (const reason of ["AI_DISABLED", "AI_BUDGET_EXCEEDED"])
      assert.deepEqual(planAccessView(denied(reason), false), { kind: "retry" });
    assert.deepEqual(planAccessView(denied("AI_RATE_LIMITED"), false), { kind: "notice", message: "msg:AI_RATE_LIMITED" });
  });
});

describe("clockSuffix", () => {
  it("follows how the time is read aloud", () => {
    const cases: Record<string, string> = {
      "21:40": "ta", "09:15": "te", "21:00": "de", "10:00": "da", "00:00": "da", "18:03": "te",
    };
    for (const [time, suffix] of Object.entries(cases)) assert.equal(clockSuffix(time), suffix, time);
  });
});

describe("isPremiumFeatureAvailable", () => {
  const view = (patch: Partial<SubscriptionView>) => patch as SubscriptionView;
  it("is open to Premium and to a feature's free taste only", () => {
    assert.equal(isPremiumFeatureAvailable(null, "plan.ai"), false);
    assert.equal(isPremiumFeatureAvailable(view({ entitlement: { isPremium: true } } as never), "plan.ai"), true);
    assert.equal(
      isPremiumFeatureAvailable(
        view({ entitlement: { isPremium: false }, features: { "plan.ai": { freeEnabled: true } } } as never),
        "plan.ai",
      ),
      true,
    );
    assert.equal(isPremiumFeatureAvailable(view({ entitlement: { isPremium: false } } as never), "plan.ai"), false);
  });
});
