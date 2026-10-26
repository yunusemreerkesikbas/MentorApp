import { describe, expect, it } from "vitest";
import { PromotionRuleType } from "@mentor/types";
import { adminCreatePromotionSchema } from "@mentor/validation";
import { countDatesWithin, evaluateRule, type PromotionRuleContext } from "./promotion-rule";

const NOW = new Date("2026-08-30T12:00:00Z");
const DAY_MS = 86_400_000;

function ctx(overrides: Partial<PromotionRuleContext> = {}): PromotionRuleContext {
  return {
    now: NOW,
    userCreatedAt: NOW,
    hadAnySubscription: false,
    lostPremiumAccess: false,
    activeDates: [],
    invitedAt: null,
    hasPaid: false,
    phoneFingerprint: null,
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
    it("qualifies a subscriber who lost premium access", () => {
      expect(evaluateRule(PromotionRuleType.WIN_BACK, {}, ctx({ lostPremiumAccess: true }))).toBe(
        true,
      );
    });

    it("rejects a subscriber who still has access", () => {
      // Includes the user who cancelled but is still inside the paid period — they have not
      // lost anything yet, so there is nothing to win back.
      expect(evaluateRule(PromotionRuleType.WIN_BACK, {}, ctx({ lostPremiumAccess: false }))).toBe(
        false,
      );
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

  describe("INVITED", () => {
    const params = { withinDays: 30 };
    const invited = (overrides: Partial<PromotionRuleContext> = {}) =>
      ctx({ invitedAt: new Date(NOW.getTime() - 10 * DAY_MS), phoneFingerprint: "fp-1", ...overrides });

    it("qualifies an invited, phone-verified user who never paid, inside the window", () => {
      expect(evaluateRule(PromotionRuleType.INVITED, params, invited())).toBe(true);
    });

    it("qualifies exactly at the window boundary", () => {
      const invitedAt = new Date(NOW.getTime() - 30 * DAY_MS);
      expect(evaluateRule(PromotionRuleType.INVITED, params, invited({ invitedAt }))).toBe(true);
    });

    it("rejects once the window since the redeem has passed", () => {
      const invitedAt = new Date(NOW.getTime() - 30 * DAY_MS - 1);
      expect(evaluateRule(PromotionRuleType.INVITED, params, invited({ invitedAt }))).toBe(false);
    });

    it("rejects a user who already paid real money (a trial alone does not count as paid)", () => {
      expect(evaluateRule(PromotionRuleType.INVITED, params, invited({ hasPaid: true }))).toBe(false);
    });

    it("rejects a user without a verified phone", () => {
      expect(evaluateRule(PromotionRuleType.INVITED, params, invited({ phoneFingerprint: null }))).toBe(
        false,
      );
    });

    it("rejects a user who never redeemed an invite", () => {
      expect(evaluateRule(PromotionRuleType.INVITED, params, invited({ invitedAt: null }))).toBe(false);
    });

    it("falls back to a 30-day window when the params carry none", () => {
      const at = (days: number) => invited({ invitedAt: new Date(NOW.getTime() - days * DAY_MS) });
      expect(evaluateRule(PromotionRuleType.INVITED, {}, at(29))).toBe(true);
      expect(evaluateRule(PromotionRuleType.INVITED, {}, at(31))).toBe(false);
    });
  });
});

describe("adminCreatePromotionSchema rule params", () => {
  const base = {
    name: "Davet indirimi",
    labelTr: "Davet hediyesi",
    labelEn: "Invite gift",
    discountType: "PERCENT",
    discountValue: 30,
  } as const;

  it("accepts an INVITED promotion with { withinDays }", () => {
    const parsed = adminCreatePromotionSchema.safeParse({
      ...base,
      ruleType: "INVITED",
      ruleParams: { withinDays: 30 },
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects an INVITED promotion without { withinDays }", () => {
    const parsed = adminCreatePromotionSchema.safeParse({ ...base, ruleType: "INVITED", ruleParams: {} });
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues.map((issue) => issue.path.join("."))).toContain("ruleParams");
  });
});
