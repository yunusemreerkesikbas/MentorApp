import { PromotionRuleType } from "@mentor/types";

const DAY_MS = 86_400_000;

/** yyyy-mm-dd in UTC — matches how coaching writes `daily_activity.activity_date` (its date.util). */
function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function num(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/**
 * Everything a rule may inspect. Assembled by the CALLER (payments), so this module never reads
 * another bounded context's tables — `docs/core/architecture.md`: modules talk through interfaces.
 */
export interface PromotionRuleContext {
  now: Date;
  userCreatedAt: Date;
  /** Has the user EVER had a subscription row? Payments-owned (same signal as trial-once). */
  hadAnySubscription: boolean;
  /**
   * Had a subscription and no longer has premium — the WIN_BACK signal.
   *
   * DERIVED, never the raw `subscriptions.status`: a subscription that simply ran out still reads
   * `ACTIVE` in the table (nothing writes EXPIRED except the provider's cancel webhook), so the
   * raw status would miss exactly the population this rule exists for. It also correctly excludes
   * a user who cancelled but is still inside the paid period — they have not lost anything yet.
   */
  lostPremiumAccess: boolean;
  /**
   * Distinct studied days (yyyy-mm-dd) already fetched for the widest candidate window.
   * Coaching-owned (`daily_activity`) — read via CoachingModule's public service, never directly.
   * An empty array simply means no ACTIVE_DAYS rule can match.
   */
  activeDates: readonly string[];
}

/** Distinct dates inside the `windowDays` calendar days ending today, inclusive (UTC). */
export function countDatesWithin(
  dates: readonly string[],
  now: Date,
  windowDays: number,
): number {
  const today = isoDate(now);
  const from = isoDate(new Date(now.getTime() - (windowDays - 1) * DAY_MS));
  const seen = new Set<string>();
  for (const date of dates) {
    if (date >= from && date <= today) seen.add(date);
  }
  return seen.size;
}

/**
 * Does this user qualify for this promotion? Pure — the caller resolves every signal first, so a
 * new rule type costs one case here plus its test, and never a new query inside this module.
 */
export function evaluateRule(
  type: PromotionRuleType,
  params: Record<string, unknown>,
  ctx: PromotionRuleContext,
): boolean {
  switch (type) {
    case PromotionRuleType.ANYONE:
      return true;

    case PromotionRuleType.NEW_USER: {
      const age = ctx.now.getTime() - ctx.userCreatedAt.getTime();
      return !ctx.hadAnySubscription && age <= num(params.withinDays, 7) * DAY_MS;
    }

    case PromotionRuleType.WIN_BACK:
      return ctx.lostPremiumAccess;

    case PromotionRuleType.ACTIVE_DAYS:
      return (
        countDatesWithin(ctx.activeDates, ctx.now, num(params.windowDays, 7)) >=
        num(params.days, 5)
      );

    default:
      // Unreachable while the rule_type CHECK constraint holds; deny rather than throw.
      return false;
  }
}
