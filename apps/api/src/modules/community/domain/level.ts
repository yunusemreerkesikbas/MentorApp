import type { CommunityLevelView } from "@mentor/types";

/**
 * Cumulative XP needed to be AT each tier (index 0 = tier 1). Effort ladder — positive tier names
 * live in the client i18n (`community.level.*`). // ponytail: static thresholds; move to config only
 * if product wants to tune the curve live.
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
