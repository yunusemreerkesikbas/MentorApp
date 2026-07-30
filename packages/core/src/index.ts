/**
 * @mentor/core — framework-agnostic domain constants/helpers.
 *
 * PRINCIPLE (§0): the product is exam-agnostic. Exams differ only by *config*.
 * The net rule is one example: KPSS/YKS → C − W/4, LGS → C − W/3.
 * This is only the config contract; analysis feature code comes later in the api.
 */
import { ExamType, type CommunityLevelView } from "@mentor/types";

/** Per-exam wrong-answer penalty divisor (net = correct − wrong / penaltyDivisor). */
export const NET_PENALTY_DIVISOR: Record<ExamType, number> = {
  [ExamType.KPSS]: 4,
  [ExamType.YKS]: 4,
  [ExamType.LGS]: 3,
};

export const APP_NAME = "Mentor" as const;

export const STREAK_MILESTONES = [7, 14, 30, 100, 365] as const;
export type StreakMilestoneValue = (typeof STREAK_MILESTONES)[number];

/**
 * Cumulative XP needed to be AT each tier (index 0 = tier 1). Effort ladder — positive tier names
 * live in the client i18n (`community.level_*`). Shared invariant: community renders it on public
 * profiles/leaderboard, economy returns it with the self balance — one curve, one place.
 * // ponytail: static thresholds; move to config only if product wants to tune the curve live.
 */
const TIER_THRESHOLDS = [0, 100, 300, 600, 1000, 1500, 2200, 3000, 4200, 5600, 7500, 10000] as const;

/** Map total XP to a 1-based tier + the threshold for the next tier (null at the top). */
export function deriveLevel(xp: number): CommunityLevelView {
  let tier = 1;
  for (let i = 0; i < TIER_THRESHOLDS.length; i++) {
    if (xp >= TIER_THRESHOLDS[i]!) tier = i + 1;
  }
  const nextAt = TIER_THRESHOLDS[tier] ?? null;
  return { tier, xp, nextAt };
}
