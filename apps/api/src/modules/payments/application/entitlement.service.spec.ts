import { describe, expect, it } from "vitest";
import { computeEntitlement } from "./entitlement.service";
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
