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

/** Permanent V1 achievements. Definitions and rules are code-owned and append-only. */
export const AchievementId = {
  FIRST_STEP: "first_step",
  ROUTE_DRAWN: "route_drawn",
  DREAM_SPACE_CREATED: "dream_space_created",
  RHYTHM_FOUND: "rhythm_found",
  RHYTHM_KEPT: "rhythm_kept",
  RETURNED_TO_PATH: "returned_to_path",
  ROUTE_RENEWED: "route_renewed",
  STARTING_POINT_SET: "starting_point_set",
  MISTAKE_REVISITED: "mistake_revisited",
  WEEK_REFLECTED: "week_reflected",
  FIRST_HELLO: "first_hello",
  HELPED_SOMEONE: "helped_someone",
} as const;
export type AchievementId = (typeof AchievementId)[keyof typeof AchievementId];

export type AchievementSource = "LIVE" | "BACKFILL";
export type AchievementStatus = "LOCKED" | "EARNED";

export interface AchievementProgress {
  current: number;
  target: number;
}

export interface AchievementView {
  id: AchievementId;
  title: string;
  description: string;
  /** Localized, action-oriented guidance shown only while the achievement is locked. */
  unlockHint: string;
  artKey: AchievementId;
  status: AchievementStatus;
  earnedAt: string | null;
  progress: AchievementProgress | null;
}

export interface AchievementCollectionDto {
  ownerView: boolean;
  items: AchievementView[];
}

export type AchievementCelebrationDto =
  | { kind: "ACHIEVEMENT"; items: [AchievementView] }
  | { kind: "BACKFILL_SUMMARY"; items: AchievementView[] };

export interface AchievementCelebrationsDto {
  celebrations: AchievementCelebrationDto[];
}

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

/**
 * GET /v1/community/profile/:username — a public user profile header (identity + gamification).
 * Public-safe: NO email or other PII; xp/level are already public via the leaderboard.
 */
export interface PublicProfile {
  userId: string;
  displayName: string;
  username: string;
  /** Global rollout gate; clients hide achievement surfaces while false. */
  achievementsEnabled: boolean;
  avatarUrl: string | null;
  examType: string | null;
  /** ISO — drives "member since". */
  createdAt: string;
  /** Public self-description; null when unset. */
  bio: string | null;
  /** Public personal link (http/https); null when unset. */
  website: string | null;
  streak: number;
  badges: CommunityBadgeId[];
  /** Total XP; null when the economy is disabled. */
  xp: number | null;
  level: CommunityLevelView | null;
  /** How many users follow this profile. */
  followerCount: number;
  /** How many users this profile follows. */
  followingCount: number;
  /** Authored threads + non-deleted comments/replies. */
  activityCount: number;
  /** Public premium marker only; subscription details remain private. */
  isPremium: boolean;
  /** Whether the viewer follows this profile. false when it's the viewer's own profile (can't follow self). */
  isFollowing: boolean;
  /** Viewer's study-buddy relation to this profile (drives the profile buddy button). */
  buddyStatus: BuddyStatus;
}

/**
 * Viewer↔profile study-buddy relation. "unavailable" = the viewer already has an active
 * buddy with someone else (button hidden — one active buddy per user in v1).
 */
export type BuddyStatus =
  | "none"
  | "pending_outgoing"
  | "pending_incoming"
  | "active"
  | "unavailable";

/** A buddy counterpart reference (public-safe — no PII, effort fields only). */
export interface BuddyUserRef {
  userId: string;
  displayName: string;
  username: string | null;
  avatarUrl: string | null;
}

/** An incoming/outgoing pending buddy request. */
export interface BuddyRequestRef {
  id: string;
  partner: BuddyUserRef;
  createdAt: string; // ISO
}

/** The viewer's active pairing with the partner's TODAY effort (never exam results — §4). */
export interface BuddyActiveView {
  pairId: string;
  partner: BuddyUserRef;
  /** Partner's accumulated COMPLETED focus minutes today. */
  focusMinutesToday: number;
  /** Partner's current study streak (days). */
  currentStreak: number;
  /** Whether the partner is in a focus session right now (live presence). */
  partnerStudyingNow: boolean;
  /** False while the viewer's poke (nudge/invite) cooldown is running. */
  canNudge: boolean;
  /** ISO end of the viewer's nudge cooldown; null when nudging is available. */
  nudgeCooldownEndsAt: string | null;
}

/** GET /v1/buddy — the whole buddy surface in one call. */
export interface BuddyViewDto {
  active: BuddyActiveView | null;
  outgoing: BuddyRequestRef | null;
  incoming: BuddyRequestRef[];
}

/**
 * A user reference in a follower/following list (public-safe — no PII). `isFollowing` is the *viewer's*
 * relationship to this user, so the list can show a follow-back button.
 */
export interface FollowUserRef {
  userId: string;
  displayName: string;
  username: string;
  avatarUrl: string | null;
  isFollowing: boolean;
}

/** GET /v1/users/:username/followers|following — cursor-paginated user list, newest-follow first. */
export interface FollowList {
  items: FollowUserRef[];
  nextCursor: string | null;
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
