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
  emoji?: string | null;
  isArchived: boolean;
  memberCount: number;
  /** Viewer's membership status; null when not a member. */
  myStatus: ZoneMemberStatus | null;
  /** Viewer's role in this zone; null when not a member. */
  myRole: ZoneRole | null;
  /** True when the viewer may moderate this zone (owner/mod here, or platform staff). */
  canModerate: boolean;
  createdAt: string;
}

/** GET /v1/forum/zones/:id/members — owner/mod view (e.g. pending join requests to approve). */
export interface ZoneMemberView {
  userId: string;
  role: ZoneRole;
  status: ZoneMemberStatus;
  createdAt: string;
}

/**
 * Reactions collapsed to a single "like" (❤️) — APP-017 pulled a Threads-style like/comment into
 * MVP. The reaction table/endpoints stay generic (emoji column), but the app allows only this one.
 * The richer positive-emoji palette (👍💪🎉😮) is a backlog item behind config if it returns.
 */
export const FORUM_LIKE_EMOJI = "❤️" as const;
export const FORUM_REACTION_EMOJIS = [FORUM_LIKE_EMOJI] as const;
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
  /** Author's display name (human name). */
  authorName: string;
  /** Author's @handle; null when they haven't set a username. */
  authorUsername: string | null;
  /** Author's public avatar URL; null falls back to initials. */
  authorAvatarUrl: string | null;
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
  /** Number of (non-deleted) comments/answers on this thread. */
  commentCount: number;
  /** Display names of up to 3 recent distinct commenters (for the replier-avatar cluster). */
  commenterNames: string[];
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
  authorName: string;
  authorUsername: string | null;
  authorAvatarUrl: string | null;
  body: string;
  isAccepted: boolean;
  createdAt: string;
}

/** GET /v1/forum/threads/:id — a QA question with its answers (accepted first). */
export interface QuestionDetail {
  question: ThreadView;
  answers: AnswerView[];
}

/**
 * A comment on a CHAT/ANNOUNCEMENT thread (APP-017 recursive threads). Every comment is itself
 * likeable + replyable; `parentPostId` null = top-level comment, set = a reply to another comment.
 * QA answers keep the leaner `AnswerView` (QA is out of scope for likes/nesting).
 */
export interface CommentView {
  id: string;
  threadId: string;
  parentPostId: string | null;
  authorId: string;
  authorName: string;
  authorUsername: string | null;
  authorAvatarUrl: string | null;
  body: string;
  likeCount: number;
  /** Whether the viewer has liked this comment. */
  myLiked: boolean;
  /** Number of (non-deleted) direct replies. */
  replyCount: number;
  createdAt: string;
}

/**
 * GET /v1/forum/threads/:id/detail — a CHAT/ANNOUNCEMENT thread with its top-level comments.
 * Nested replies are loaded per-comment via the comment detail endpoint (Twitter-style navigation).
 */
export interface ThreadDetail {
  thread: ThreadView;
  comments: CommentView[];
}

/** GET /v1/forum/posts/:postId — a focused comment with its direct replies (oldest-first). */
export interface CommentDetail {
  comment: CommentView;
  replies: CommentView[];
}

/** Public (anonymous, SEO) QA shapes — no authorId/PII. Only indexable QA questions are exposed. */
export interface PublicAnswerView {
  id: string;
  body: string;
  isAccepted: boolean;
  createdAt: string;
}

export interface PublicQuestionView {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  answers: PublicAnswerView[];
}

/** Sitemap entry for an indexable QA question. */
export interface PublicQuestionRef {
  id: string;
  updatedAt: string;
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
