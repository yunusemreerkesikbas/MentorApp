/**
 * Community module contracts — the right-column "Emek Panosu" (effort board). Shared by api
 * (producer) and web (consumer). Effort/XP only; net/exam results are NEVER ranked or shown (§3).
 */

/** Positive behaviour badges (labels + icons live in the client i18n; the server sends ids only). */
export const CommunityBadgeId = {
  /** streak ≥ 7 days. */
  MARATHON: "marathon",
  /** most of the user's posts land 00:00–05:00. */
  NIGHT_OWL: "night_owl",
  /** the user's posts have drawn many reactions. */
  MOTIVATOR: "motivator",
  /** joined less than two weeks ago. */
  NEWCOMER: "newcomer",
} as const;
export type CommunityBadgeId = (typeof CommunityBadgeId)[keyof typeof CommunityBadgeId];

/** XP tier snapshot. `tier` is 1-based; `nextAt` is the XP needed for the next tier (null at top). */
export interface CommunityLevelView {
  tier: number;
  xp: number;
  nextAt: number | null;
}

/**
 * Rank change vs the previous period (weekly→last week, today→yesterday). `null` when the window has
 * no meaningful movement (all_time). Framed gently: a drop is muted, never shamed (§4 anti-shaming).
 */
export type RankMovement = "up" | "down" | "same" | "new" | null;

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  displayName: string;
  /** Public avatar URL; null when the user has no avatar set. */
  avatarUrl: string | null;
  xp: number;
  isMe: boolean;
  /** Movement vs the previous period; null for all_time / no prior data isn't "new" only at read. */
  movement: RankMovement;
}

/** Time window a ranking is scoped to. Boundaries are Europe/Istanbul (day/week); all_time = since epoch. */
export type LeaderboardWindow = "today" | "weekly" | "all_time";

/** Exam-type-scoped effort ranking for a time window. */
export interface LeaderboardView {
  window: LeaderboardWindow;
  /** The cohort the ranking is scoped to (viewer's exam type); null = the "no exam type" cohort. */
  examType: string | null;
  items: LeaderboardEntry[];
  /** Viewer's own standing; null when they earned no XP this week (nothing to rank yet). */
  me: LeaderboardEntry | null;
  /** Distinct XP earners in the cohort this window — drives the "ahead of X%" band. */
  totalParticipants: number;
}

/** GET /v1/community/summary — everything the right-column effort board needs in one call. */
export interface CommunitySummary {
  /** Current study streak in days — economy-independent. */
  streak: number;
  /** True when the light economy is user-facing; drives graceful UI degradation on the client. */
  economyEnabled: boolean;
  /** Positive behaviour badges — always present (economy-independent). */
  badges: CommunityBadgeId[];
  /** Total XP; null when the economy is disabled. */
  xp: number | null;
  level: CommunityLevelView | null;
  leaderboard: LeaderboardView | null;
}
