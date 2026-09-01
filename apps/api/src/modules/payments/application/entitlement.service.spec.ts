import { describe, expect, it } from "vitest";
import { computeEntitlement, hasLostAccess, hasRunOut } from "./entitlement.service";
import type { SubscriptionRow } from "../infrastructure/payments.repositories";

const NOW = new Date("2026-06-10T12:00:00Z");
const days = (n: number) => new Date(NOW.getTime() + n * 24 * 60 * 60 * 1000);

function sub(partial: Partial<SubscriptionRow>): SubscriptionRow {
  return {
    id: "s1",
    userId: "u1",
    planId: "premium-monthly",
    status: "ACTIVE",
    provider: "FAKE",
    providerRef: "ref",
    trialEndsAt: null,
    currentPeriodStart: days(-10),
    currentPeriodEnd: days(20),
    cancelAtPeriodEnd: false,
    canceledAt: null,
    createdAt: days(-10),
    updatedAt: days(-1),
    ...partial,
  } as SubscriptionRow;
}

describe("computeEntitlement (state matrix)", () => {
  it("no subscription → FREE/NONE", () => {
    const e = computeEntitlement(null, NOW);
    expect(e.isPremium).toBe(false);
    expect(e.reason).toBe("NONE");
  });

  it("INCOMPLETE → FREE (verification gate withholds premium until webhook activation)", () => {
    const e = computeEntitlement(sub({ status: "INCOMPLETE", trialEndsAt: days(5) }), NOW);
    expect(e.isPremium).toBe(false);
    expect(e.reason).toBe("INCOMPLETE");
  });

  it("TRIALING within trial → PREMIUM until trialEndsAt", () => {
    const e = computeEntitlement(sub({ status: "TRIALING", trialEndsAt: days(5) }), NOW);
    expect(e.isPremium).toBe(true);
    expect(e.reason).toBe("TRIALING");
    expect(e.validUntil).toBe(days(5).toISOString());
  });

  it("TRIALING past trial end → FREE", () => {
    const e = computeEntitlement(sub({ status: "TRIALING", trialEndsAt: days(-1) }), NOW);
    expect(e.isPremium).toBe(false);
  });

  it("ACTIVE within period → PREMIUM", () => {
    expect(computeEntitlement(sub({}), NOW).isPremium).toBe(true);
  });

  it("PAST_DUE within grace → PREMIUM/GRACE (dunning §7)", () => {
    const e = computeEntitlement(
      sub({ status: "PAST_DUE", currentPeriodEnd: days(-1) }), // failed 1 day ago, grace=3d
      NOW,
    );
    expect(e.isPremium).toBe(true);
    expect(e.reason).toBe("GRACE");
  });

  it("PAST_DUE past grace → FREE", () => {
    const e = computeEntitlement(sub({ status: "PAST_DUE", currentPeriodEnd: days(-5) }), NOW);
    expect(e.isPremium).toBe(false);
  });

  it("CANCELED before period end → PREMIUM until period end (§7 self-serve cancel)", () => {
    const e = computeEntitlement(sub({ status: "CANCELED", currentPeriodEnd: days(10) }), NOW);
    expect(e.isPremium).toBe(true);
    expect(e.reason).toBe("CANCELED_PERIOD");
  });

  it("CANCELED after period end / EXPIRED → FREE", () => {
    expect(
      computeEntitlement(sub({ status: "CANCELED", currentPeriodEnd: days(-1) }), NOW).isPremium,
    ).toBe(false);
    expect(computeEntitlement(sub({ status: "EXPIRED" }), NOW).isPremium).toBe(false);
  });
});

describe("hasRunOut (expiry sweeper predicate)", () => {
  it("retires a subscription whose paid period has passed", () => {
    expect(hasRunOut(sub({ status: "ACTIVE", currentPeriodEnd: days(-1) }), NOW)).toBe(true);
    expect(hasRunOut(sub({ status: "CANCELED", currentPeriodEnd: days(-1) }), NOW)).toBe(true);
    expect(
      hasRunOut(sub({ status: "TRIALING", trialEndsAt: days(-1), currentPeriodEnd: days(-1) }), NOW),
    ).toBe(true);
  });

  it("leaves a live subscription alone", () => {
    expect(hasRunOut(sub({ status: "ACTIVE", currentPeriodEnd: days(5) }), NOW)).toBe(false);
    expect(hasRunOut(sub({ status: "CANCELED", currentPeriodEnd: days(5) }), NOW)).toBe(false);
  });

  it("respects the dunning grace before retiring a PAST_DUE row", () => {
    // GRACE_PERIOD_DAYS = 3: still premium at -2 days, gone at -4.
    expect(hasRunOut(sub({ status: "PAST_DUE", currentPeriodEnd: days(-2) }), NOW)).toBe(false);
    expect(hasRunOut(sub({ status: "PAST_DUE", currentPeriodEnd: days(-4) }), NOW)).toBe(true);
  });

  it("never touches an INCOMPLETE checkout", () => {
    // Grants no premium, but it is a verification gate — checkout deletes it, the sweeper must not
    // retire it, or a user mid-payment would be locked out of retrying.
    expect(hasRunOut(sub({ status: "INCOMPLETE", currentPeriodEnd: days(-9) }), NOW)).toBe(false);
  });

  it("is idempotent — an already-EXPIRED row is not swept again", () => {
    expect(hasRunOut(sub({ status: "EXPIRED", currentPeriodEnd: days(-9) }), NOW)).toBe(false);
  });
});

describe("hasLostAccess (WIN_BACK signal)", () => {
  it("counts an already-retired subscription — unlike the sweeper predicate", () => {
    // The distinction that matters: hasRunOut says "do not sweep again", hasLostAccess says
    // "this user did lose premium". Conflating them silently kills the win-back rule.
    const retired = sub({ status: "EXPIRED", currentPeriodEnd: days(-9) });
    expect(hasRunOut(retired, NOW)).toBe(false);
    expect(hasLostAccess(retired, NOW)).toBe(true);
  });

  it("counts a subscription that quietly lapsed while still reading ACTIVE", () => {
    expect(hasLostAccess(sub({ status: "ACTIVE", currentPeriodEnd: days(-1) }), NOW)).toBe(true);
  });

  it("rejects a user who still has access, cancelled-but-in-period included", () => {
    expect(hasLostAccess(sub({ status: "ACTIVE", currentPeriodEnd: days(5) }), NOW)).toBe(false);
    expect(hasLostAccess(sub({ status: "CANCELED", currentPeriodEnd: days(5) }), NOW)).toBe(false);
  });

  it("rejects a user mid-checkout and one who never subscribed", () => {
    expect(hasLostAccess(sub({ status: "INCOMPLETE" }), NOW)).toBe(false);
    expect(hasLostAccess(null, NOW)).toBe(false);
  });
});
