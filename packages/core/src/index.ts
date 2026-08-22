/**
 * @mentor/core — framework-agnostic domain constants/helpers.
 *
 * PRINCIPLE (§0): the product is exam-agnostic. Exams differ only by *config*.
 * The net rule is one example: KPSS/YKS → C − W/4, LGS → C − W/3.
 * This is only the config contract; analysis feature code comes later in the api.
 */
import {
  ExamType,
  JourneyLevelChapterId,
  JourneyLevelKey,
  type CommunityLevelView,
} from "@mentor/types";

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

const JOURNEY_LEVELS = [
  { key: JourneyLevelKey.SPARK, chapter: JourneyLevelChapterId.AWAKENING },
  { key: JourneyLevelKey.TRAIL, chapter: JourneyLevelChapterId.AWAKENING },
  { key: JourneyLevelKey.COMPASS, chapter: JourneyLevelChapterId.AWAKENING },
  { key: JourneyLevelKey.CYCLE, chapter: JourneyLevelChapterId.HARMONY },
  { key: JourneyLevelKey.RHYTHM, chapter: JourneyLevelChapterId.HARMONY },
  { key: JourneyLevelKey.FLOW, chapter: JourneyLevelChapterId.HARMONY },
  { key: JourneyLevelKey.ROOT, chapter: JourneyLevelChapterId.DEEPENING },
  { key: JourneyLevelKey.WING, chapter: JourneyLevelChapterId.DEEPENING },
  { key: JourneyLevelKey.HORIZON, chapter: JourneyLevelChapterId.DEEPENING },
  { key: JourneyLevelKey.LANTERN, chapter: JourneyLevelChapterId.SHARED_LIGHT },
  { key: JourneyLevelKey.STAR, chapter: JourneyLevelChapterId.SHARED_LIGHT },
  { key: JourneyLevelKey.CONSTELLATION, chapter: JourneyLevelChapterId.SHARED_LIGHT },
] as const;

export function getJourneyLevelByTier(tier: number): {
  tier: number;
  key: JourneyLevelKey;
  chapter: JourneyLevelChapterId;
} {
  const level = JOURNEY_LEVELS[tier - 1];
  if (!Number.isInteger(tier) || !level) {
    throw new RangeError("Journey level tier must be between 1 and 12");
  }
  return { tier, key: level.key, chapter: level.chapter };
}

/** Map total XP to a 1-based tier + the threshold for the next tier (null at the top). */
export function deriveLevel(xp: number): CommunityLevelView {
  const effectiveXp = Math.max(0, xp);
  let tier = 1;
  for (let i = 0; i < TIER_THRESHOLDS.length; i++) {
    if (effectiveXp >= TIER_THRESHOLDS[i]!) tier = i + 1;
  }
  const currentAt = TIER_THRESHOLDS[tier - 1]!;
  const nextAt = TIER_THRESHOLDS[tier] ?? null;
  const level = JOURNEY_LEVELS[tier - 1]!;
  const nextLevel = JOURNEY_LEVELS[tier] ?? null;
  const progress = nextAt === null
    ? null
    : (() => {
        const target = nextAt - currentAt;
        const current = Math.min(target, Math.max(0, effectiveXp - currentAt));
        return {
          current,
          target,
          remaining: target - current,
          percent: Math.min(100, Math.max(0, Math.round((current / target) * 100))),
        };
      })();

  return {
    tier,
    xp,
    nextAt,
    key: level.key,
    chapter: level.chapter,
    currentAt,
    nextKey: nextLevel?.key ?? null,
    progress,
  };
}
