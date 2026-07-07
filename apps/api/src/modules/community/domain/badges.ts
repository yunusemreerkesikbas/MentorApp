import { CommunityBadgeId } from "@mentor/types";

/** Raw per-user signals the badge rules read. Gathered by the repository; the rules stay pure. */
export interface BadgeSignals {
  currentStreak: number;
  memberSince: Date;
  totalPosts: number;
  /** Posts authored 00:00–05:00. */
  nightPosts: number;
  reactionsReceived: number;
  /** Injectable clock for deterministic tests. */
  now?: Date;
}

const MARATHON_STREAK = 7;
const NEWCOMER_DAYS = 14;
/** Enough posts that a night-skew reads as a habit, not one late night. */
const NIGHT_OWL_MIN_POSTS = 5;
const MOTIVATOR_MIN_REACTIONS = 10;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Derive positive identity badges from signals we already store — no Badge table (§3). Framing is
 * always positive; there are no negative/hurtful badges. Order here is display order.
 * // ponytail: derived rules; add a Badge/UserBadge table only when badges become admin-authored.
 */
export function deriveBadges(s: BadgeSignals): CommunityBadgeId[] {
  const now = s.now ?? new Date();
  const badges: CommunityBadgeId[] = [];

  if (s.currentStreak >= MARATHON_STREAK) badges.push(CommunityBadgeId.MARATHON);
  if (s.totalPosts >= NIGHT_OWL_MIN_POSTS && s.nightPosts * 2 > s.totalPosts)
    badges.push(CommunityBadgeId.NIGHT_OWL);
  if (s.reactionsReceived >= MOTIVATOR_MIN_REACTIONS) badges.push(CommunityBadgeId.MOTIVATOR);
  if ((now.getTime() - s.memberSince.getTime()) / DAY_MS < NEWCOMER_DAYS)
    badges.push(CommunityBadgeId.NEWCOMER);

  return badges;
}
