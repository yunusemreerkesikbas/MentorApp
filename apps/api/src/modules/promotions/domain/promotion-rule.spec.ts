import { describe, expect, it } from "vitest";
import { PromotionRuleType } from "@mentor/types";
import { countDatesWithin, evaluateRule, type PromotionRuleContext } from "./promotion-rule";

const NOW = new Date("2026-08-30T12:00:00Z");
const DAY_MS = 86_400_000;

function ctx(overrides: Partial<PromotionRuleContext> = {}): PromotionRuleContext {
  return {
    now: NOW,
    userCreatedAt: NOW,
    hadAnySubscription: false,
    lastSubscriptionStatus: null,
    activeDates: [],
    ...overrides,
  };
}

describe("countDatesWithin", () => {
  it("counts a window of N calendar days ending today", () => {
    // 7-day window on 2026-08-30 covers 08-24 … 08-30 inclusive.
    expect(countDatesWithin(["2026-08-24", "2026-08-30"], NOW, 7)).toBe(2);
    expect(countDatesWithin(["2026-08-23"], NOW, 7)).toBe(0);
  });

  it("deduplicates repeated dates", () => {
    expect(countDatesWithin(["2026-08-29", "2026-08-29"], NOW, 7)).toBe(1);
  });

  it("ignores future dates", () => {
    expect(countDatesWithin(["2026-09-05"], NOW, 7)).toBe(0);
  });
});

describe("evaluateRule", () => {
  it("ANYONE always qualifies", () => {
    expect(evaluateRule(PromotionRuleType.ANYONE, {}, ctx())).toBe(true);
  });

  describe("NEW_USER", () => {
    const params = { withinDays: 7 };

    it("qualifies a fresh signup that never subscribed", () => {
      expect(evaluateRule(PromotionRuleType.NEW_USER, params, ctx())).toBe(true);
    });

    it("qualifies exactly at the window boundary", () => {
      const userCreatedAt = new Date(NOW.getTime() - 7 * DAY_MS);
      expect(evaluateRule(PromotionRuleType.NEW_USER, params, ctx({ userCreatedAt }))).toBe(true);
    });

    it("rejects a signup older than the window", () => {
      const userCreatedAt = new Date(NOW.getTime() - 7 * DAY_MS - 1);
      expect(evaluateRule(PromotionRuleType.NEW_USER, params, ctx({ userCreatedAt }))).toBe(false);
    });

    it("rejects a user who has ever had a subscription", () => {
      expect(
        evaluateRule(PromotionRuleType.NEW_USER, params, ctx({ hadAnySubscription: true })),
      ).toBe(false);
    });
  });

  describe("WIN_BACK", () => {
    it.each(["EXPIRED", "CANCELED"])("qualifies a %s subscriber", (status) => {
      expect(
        evaluateRule(PromotionRuleType.WIN_BACK, {}, ctx({ lastSubscriptionStatus: status })),
      ).toBe(true);
    });

    it.each(["ACTIVE", "TRIALING", "PAST_DUE", "INCOMPLETE"])("rejects a %s subscriber", (status) => {
      expect(
        evaluateRule(PromotionRuleType.WIN_BACK, {}, ctx({ lastSubscriptionStatus: status })),
      ).toBe(false);
    });

    it("rejects a user who never subscribed", () => {
      expect(evaluateRule(PromotionRuleType.WIN_BACK, {}, ctx())).toBe(false);
    });
  });

  describe("ACTIVE_DAYS", () => {
    const params = { days: 5, windowDays: 7 };
    const week = ["2026-08-24", "2026-08-25", "2026-08-26", "2026-08-27", "2026-08-28"];

    it("qualifies when enough studied days fall inside the window", () => {
      expect(evaluateRule(PromotionRuleType.ACTIVE_DAYS, params, ctx({ activeDates: week }))).toBe(
        true,
      );
    });

    it("rejects when one day short", () => {
      expect(
        evaluateRule(PromotionRuleType.ACTIVE_DAYS, params, ctx({ activeDates: week.slice(1) })),
      ).toBe(false);
    });

    it("excludes days that fell out of the window", () => {
      const stale = ["2026-08-20", "2026-08-21", "2026-08-22", "2026-08-23", ...week.slice(0, 1)];
      expect(evaluateRule(PromotionRuleType.ACTIVE_DAYS, params, ctx({ activeDates: stale }))).toBe(
        false,
      );
    });

    it("rejects when no activity is supplied at all", () => {
      expect(evaluateRule(PromotionRuleType.ACTIVE_DAYS, params, ctx())).toBe(false);
    });
  });
});
