/**
 * Forum module contracts (Phase-2 pulled into MVP — design 2026-06-22).
 *
 * One Zone primitive, three behaviours (announcement / chat / qa). Shared by api (producer)
 * and web/admin (consumers). Coin is NEVER part of forum (§4 #3); only XP is granted, by economy.
 */

export const ZoneType = {
  ANNOUNCEMENT: "ANNOUNCEMENT",
  CHAT: "CHAT",
  QA: "QA",
} as const;
export type ZoneType = (typeof ZoneType)[keyof typeof ZoneType];

/** PUBLIC only in MVP; PRIVATE (invite/closed/mahalle) reserved for Phase 2. */
export const ZoneVisibility = {
  PUBLIC: "PUBLIC",
  PRIVATE: "PRIVATE",
} as const;
export type ZoneVisibility = (typeof ZoneVisibility)[keyof typeof ZoneVisibility];

export const ZoneJoinPolicy = {
  OPEN: "OPEN",
  REQUEST: "REQUEST",
} as const;
export type ZoneJoinPolicy = (typeof ZoneJoinPolicy)[keyof typeof ZoneJoinPolicy];

/** Per-zone scoped role (two-plane authz — NOT a platform role). */
export const ZoneRole = {
  OWNER: "OWNER",
  MODERATOR: "MODERATOR",
  MEMBER: "MEMBER",
} as const;
export type ZoneRole = (typeof ZoneRole)[keyof typeof ZoneRole];

export const ZoneMemberStatus = {
  ACTIVE: "ACTIVE",
  PENDING: "PENDING",
} as const;
export type ZoneMemberStatus = (typeof ZoneMemberStatus)[keyof typeof ZoneMemberStatus];

/** GET /v1/forum/zones[/:slug] — a zone with the viewer's own membership status folded in. */
export interface ZoneView {
  id: string;
  type: ZoneType;
  title: string;
  slug: string;
  description: string | null;
  visibility: ZoneVisibility;
  joinPolicy: ZoneJoinPolicy;
  examType: string | null;
  isArchived: boolean;
  memberCount: number;
  /** Viewer's membership status; null when not a member. */
  myStatus: ZoneMemberStatus | null;
  createdAt: string;
}

/** GET /v1/forum/zones/:id/members — owner/mod view (e.g. pending join requests to approve). */
export interface ZoneMemberView {
  userId: string;
  role: ZoneRole;
  status: ZoneMemberStatus;
  createdAt: string;
}

/** Allowed reactions (fixed, positive set — §3 "pozitif çerçevele"). Config-extensible later. */
export const FORUM_REACTION_EMOJIS = ["👍", "❤️", "💪", "🎉", "😮"] as const;
export type ForumReactionEmoji = (typeof FORUM_REACTION_EMOJIS)[number];

/** Thread status — meaningful only for QA questions (chat/announcement stay OPEN). */
export const ThreadStatus = {
  OPEN: "OPEN",
  ANSWERED: "ANSWERED",
} as const;
export type ThreadStatus = (typeof ThreadStatus)[keyof typeof ThreadStatus];

/**
 * A thread — a CHAT message / ANNOUNCEMENT broadcast, or a QA question. For non-QA items
 * `title`/`acceptedPostId` are null and `status` is always OPEN.
 */
export interface ThreadView {
  id: string;
  zoneId: string;
  authorId: string;
  /** QA question headline; null for chat/announcement. */
  title: string | null;
  body: string;
  status: ThreadStatus;
  /** Accepted answer's post id (QA only); null otherwise. */
  acceptedPostId: string | null;
  isPinned: boolean;
  /** emoji → count over all users. */
  reactionCounts: Record<string, number>;
  /** emoji the viewer themselves reacted with. */
  myReactions: string[];
  createdAt: string;
}

/** Cursor-paginated feed envelope. `nextCursor` is null when there are no older items. */
export interface ThreadFeed {
  items: ThreadView[];
  nextCursor: string | null;
}

/** A QA answer (forum_posts row). */
export interface AnswerView {
  id: string;
  threadId: string;
  authorId: string;
  body: string;
  isAccepted: boolean;
  createdAt: string;
}

/** GET /v1/forum/threads/:id — a QA question with its answers (accepted first). */
export interface QuestionDetail {
  question: ThreadView;
  answers: AnswerView[];
}

/** Moderation (slice 5) — what can be reported. */
export const ModerationTargetType = {
  THREAD: "THREAD",
  POST: "POST",
} as const;
export type ModerationTargetType = (typeof ModerationTargetType)[keyof typeof ModerationTargetType];

export const ReportReason = {
  SPAM: "SPAM",
  HARASSMENT: "HARASSMENT",
  OFF_TOPIC: "OFF_TOPIC",
  OTHER: "OTHER",
} as const;
export type ReportReason = (typeof ReportReason)[keyof typeof ReportReason];

export const ReportStatus = {
  OPEN: "OPEN",
  RESOLVED: "RESOLVED",
  DISMISSED: "DISMISSED",
} as const;
export type ReportStatus = (typeof ReportStatus)[keyof typeof ReportStatus];

/** GET /v1/forum/{zones/:id/reports,reports} — a moderation-queue item (owner/mod or staff). */
export interface ReportView {
  id: string;
  targetType: ModerationTargetType;
  targetId: string;
  zoneId: string;
  reporterId: string;
  reason: ReportReason;
  note: string | null;
  status: ReportStatus;
  createdAt: string;
}
