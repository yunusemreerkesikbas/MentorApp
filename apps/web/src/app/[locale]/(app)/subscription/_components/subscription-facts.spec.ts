import { describe, expect, it } from "vitest";
import type { EntitlementDto, PlanDto, SubscriptionDto } from "@mentor/types";
import { listSubscriptionFacts, subscriptionStatusKey } from "./subscription-facts";

const plan: PlanDto = {
  id: "premium-monthly",
  name: "Premium Aylık",
  periodMonths: 1,
  priceMinor: 24900,
  currency: "TRY",
  trialDays: 7,
  purchaseEnabled: true,
};

const active: SubscriptionDto = {
  id: "sub-1",
  planId: plan.id,
  status: "ACTIVE",
  startedAt: "2026-04-12T10:00:00.000Z",
  trialEndsAt: null,
  currentPeriodStart: "2026-08-12T10:00:00.000Z",
  currentPeriodEnd: "2026-09-12T10:00:00.000Z",
  cancelAtPeriodEnd: false,
};

const entitlement = (reason: string, validUntil: string | null): EntitlementDto => ({
  tier: reason === "NONE" ? "FREE" : "PREMIUM",
  isPremium: reason !== "NONE" && reason !== "EXPIRED" && reason !== "INCOMPLETE",
  validUntil,
  reason,
});

describe("listSubscriptionFacts", () => {
  it("keeps the free catalog empty — status lives in the hero", () => {
    expect(
      listSubscriptionFacts({
        entitlement: entitlement("NONE", null),
        subscription: null,
        plan: null,
      }),
    ).toEqual([]);
  });

  it("lists price, billing, start, period start, next renewal, and auto-renew", () => {
    const facts = listSubscriptionFacts({
      entitlement: entitlement("ACTIVE", active.currentPeriodEnd),
      subscription: active,
      plan,
    });

    expect(facts.map((fact) => fact.id)).toEqual([
      "price",
      "billing",
      "started",
      "period_start",
      "next_renewal",
      "renewal",
    ]);
    expect(facts.find((fact) => fact.id === "renewal")?.renewal).toBe("auto");
  });

  it("switches to access-end copy when cancel is scheduled", () => {
    const facts = listSubscriptionFacts({
      entitlement: entitlement("ACTIVE", active.currentPeriodEnd),
      subscription: { ...active, cancelAtPeriodEnd: true },
      plan,
    });

    expect(facts.map((fact) => fact.id)).toContain("access_ends");
    expect(facts.map((fact) => fact.id)).not.toContain("next_renewal");
    expect(facts.find((fact) => fact.id === "renewal")?.renewal).toBe("stops");
  });

  it("does not repeat trial end as the next renewal on the same day", () => {
    const trialEndsAt = "2026-04-19T10:00:00.000Z";
    const facts = listSubscriptionFacts({
      entitlement: entitlement("TRIALING", trialEndsAt),
      subscription: {
        ...active,
        status: "TRIALING",
        trialEndsAt,
        currentPeriodStart: "2026-04-12T10:00:00.000Z",
        currentPeriodEnd: trialEndsAt,
      },
      plan,
    });

    expect(facts.map((fact) => fact.id)).toContain("trial_ends");
    expect(facts.map((fact) => fact.id)).not.toContain("next_renewal");
    expect(facts.map((fact) => fact.id)).not.toContain("period_start");
  });

  it("skips renewal copy while checkout is still incomplete", () => {
    const facts = listSubscriptionFacts({
      entitlement: entitlement("INCOMPLETE", null),
      subscription: {
        ...active,
        status: "INCOMPLETE",
        currentPeriodEnd: null,
      },
      plan,
    });

    expect(facts.map((fact) => fact.id)).toEqual([
      "price",
      "billing",
      "started",
      "period_start",
    ]);
  });
});

describe("subscriptionStatusKey", () => {
  it("maps entitlement reasons to i18n keys", () => {
    expect(subscriptionStatusKey("ACTIVE")).toBe("reason_active");
    expect(subscriptionStatusKey("STAFF")).toBe("reason_staff");
    expect(subscriptionStatusKey(undefined)).toBe("reason_free");
  });
});
