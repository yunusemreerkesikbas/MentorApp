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

/** Curated bridge from a community topic to one personal coaching intent. */
export const ForumCoachIntent = {
  PLAN: "PLAN",
  NEXT_STEP: "NEXT_STEP",
  STUDY_METHOD: "STUDY_METHOD",
  STRATEGY: "STRATEGY",
} as const;
export type ForumCoachIntent =
  (typeof ForumCoachIntent)[keyof typeof ForumCoachIntent];

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
  /** Non-deleted thread count — the zone's activity signal ("X mesaj"). */
  threadCount: number;
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
 * `FORUM_LIKE_EMOJI` is the default (first-tap) reaction; the palette adds positive/supportive options
 * (§4 anti-shaming — positive-only, no negative/mocking emoji). A user may hold multiple reactions on one
 * item (each toggles independently). The set is a compile-time constant — tune here to add/remove.
 */
export const FORUM_LIKE_EMOJI = "❤️" as const;
export const FORUM_REACTION_EMOJIS = ["❤️", "👍", "💪", "🎉", "🙏"] as const;
export type ForumReactionEmoji = (typeof FORUM_REACTION_EMOJIS)[number];

/** Thread status — meaningful only for QA questions (chat/announcement stay OPEN). */
export const ThreadStatus = {
  OPEN: "OPEN",
  ANSWERED: "ANSWERED",
} as const;
export type ThreadStatus = (typeof ThreadStatus)[keyof typeof ThreadStatus];

/**
 * Post attachment (APP-018). Phase 1 = `image` only; `video`/`file` are a fast-follow (the DB `kind`
 * column already carries them). `url` is the resolved public URL; `width`/`height` (client-provided at
 * upload) let the gallery reserve aspect-ratio and avoid layout shift.
 */
export const AttachmentKind = {
  IMAGE: "image",
  FILE: "file",
} as const;
export type AttachmentKind = (typeof AttachmentKind)[keyof typeof AttachmentKind];

export interface Attachment {
  id: string;
  kind: AttachmentKind;
  url: string;
  mimeType: string;
  /** Object size in bytes — drives the "X MB" label on file chips. */
  sizeBytes: number;
  /** Original filename; set only for `file` kind (null for images). */
  fileName: string | null;
  width: number | null;
  height: number | null;
}

/** Max attachments per post + allowed image mimes + size cap (mirror of the API domain constants). */
export const FORUM_MAX_ATTACHMENTS = 4;
export const FORUM_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const FORUM_IMAGE_MIMES = ["image/jpeg", "image/png", "image/webp"] as const;
export type ForumImageMime = (typeof FORUM_IMAGE_MIMES)[number];

/** File attachments (APP-027): PDF + modern Office (docx/xlsx/pptx). 10 MB cap; legacy .doc/.xls/.ppt excluded. */
export const FORUM_FILE_MAX_BYTES = 10 * 1024 * 1024;
export const FORUM_FILE_MIMES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
] as const;
export type ForumFileMime = (typeof FORUM_FILE_MIMES)[number];
/** Union of everything the upload-url endpoint + attachment inputs accept. */
export const FORUM_ATTACHMENT_MIMES = [...FORUM_IMAGE_MIMES, ...FORUM_FILE_MIMES] as const;

/**
 * @mention handle = a username (lowercase `[a-z0-9_]`, 3–24). Single source so the server parser
 * (`forum/domain/mention.ts`) and the client highlighter (`MentionText`) agree on what a mention is;
 * each surface wraps it with its own boundary handling (server lookbehind vs client capture-group).
 */
export const FORUM_MENTION_HANDLE_PATTERN = "[a-z0-9_]{3,24}";

/**
 * GET /v1/forum/zones/:id/members/search — one @mention autocomplete suggestion (APP-021).
 * Active zone members whose username starts with the typed prefix; members without a username
 * can't be mentioned, so they never appear.
 */
export interface MentionSuggestion {
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

/** POST /v1/forum/attachments/upload-url → client PUTs the file to `uploadUrl`, then sends `key`. */
export interface ForumAttachmentUploadUrl {
  uploadUrl: string;
  key: string;
  expiresAt: string;
  maxBytes: number;
}

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
  /** Media attached to this thread (Phase 1: images, max 4); empty when none. */
  attachments: Attachment[];
  /** Whether the viewer has bookmarked this thread. */
  myBookmarked: boolean;
  /** Curated discovery tags (max 3). Additive for legacy thread consumers. */
  tags?: ForumTagView[];
  /** Eligible community-to-coach pilot context; null when the thread is not eligible. */
  coachBridge?: ForumCoachBridgeView | null;
  /** Positive helpful vote count (QA only). */
  helpfulVoteCount?: number;
  /** Whether the viewer has given their one helpful vote. */
  myHelpfulVote?: boolean;
  /** The latest thread/reply/reaction activity used by discovery sorting. */
  lastActivityAt?: string;
  /** Last owner edit time; null when the original content is unchanged. */
  editedAt?: string | null;
  /** Viewer-specific content actions. */
  capabilities?: ForumCapabilities;
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
  /** Media attached to this answer (Phase 2: images, max 4); empty when none. */
  attachments: Attachment[];
  /** Whether the viewer has bookmarked this answer. */
  myBookmarked: boolean;
  helpfulVoteCount?: number;
  myHelpfulVote?: boolean;
  editedAt?: string | null;
  capabilities?: ForumCapabilities;
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
  /** Reaction counts keyed by emoji (same shape as ThreadView); empty when none. */
  reactionCounts: Record<string, number>;
  /** Emojis the viewer has reacted with on this comment. */
  myReactions: string[];
  /** Number of (non-deleted) direct replies. */
  replyCount: number;
  /** Media attached to this comment (Phase 1: images, max 4); empty when none. */
  attachments: Attachment[];
  /** Whether the viewer has bookmarked this comment. */
  myBookmarked: boolean;
  helpfulVoteCount?: number;
  myHelpfulVote?: boolean;
  editedAt?: string | null;
  capabilities?: ForumCapabilities;
  createdAt: string;
}

/** Viewer-specific edit/delete/moderation actions returned by thread and post read models. */
export interface ForumCapabilities {
  canEdit: boolean;
  canDelete: boolean;
  canModerate: boolean;
  editDeadline: string | null;
}

export interface ForumTagView {
  id: string;
  slug: string;
  /** Locale-resolved public label. */
  name: string;
  /** Admin surfaces need both labels without another round-trip. */
  nameTr?: string;
  nameEn?: string;
  examType: string | null;
  isActive: boolean;
  /** Admin-curated coach bridge intent; null keeps this tag outside the pilot. */
  coachIntent?: ForumCoachIntent | null;
  createdAt?: string;
  updatedAt?: string;
}

/** Public-safe community context; never contains thread body, authors, comments, or profile data. */
export interface ForumCoachBridgeView {
  threadId: string;
  intent: ForumCoachIntent;
  tag: Pick<ForumTagView, "slug" | "name">;
  zone: Pick<ZoneView, "slug" | "title" | "type">;
  /** Nullable because CHAT posts may not have a headline. */
  threadTitle: string | null;
}

export const ForumFeedScope = {
  RELEVANT: "relevant",
  FOLLOWING: "following",
} as const;
export type ForumFeedScope = (typeof ForumFeedScope)[keyof typeof ForumFeedScope];

export const ForumFeedSort = {
  TRENDING: "trending",
  RECENT: "recent",
  TOP: "top",
} as const;
export type ForumFeedSort = (typeof ForumFeedSort)[keyof typeof ForumFeedSort];

export interface ForumPublicPerson {
  id: string;
  displayName: string;
  username: string;
  avatarUrl: string | null;
}

export interface ForumFeedItem {
  id: string;
  zone: Pick<ZoneView, "id" | "title" | "slug" | "type">;
  author: ForumPublicPerson;
  title: string | null;
  body: string;
  status: ThreadStatus;
  acceptedPostId: string | null;
  isPinned: boolean;
  tags: ForumTagView[];
  reactionCounts: Record<string, number>;
  myReactions: string[];
  helpfulVoteCount: number;
  myHelpfulVote: boolean;
  commentCount: number;
  attachments: Attachment[];
  myBookmarked: boolean;
  capabilities: ForumCapabilities;
  createdAt: string;
  lastActivityAt: string;
  editedAt: string | null;
  /** Server-computed ranking signal. Never recomputed by clients. */
  score: number;
}

export interface ForumThreadSummary {
  id: string;
  zoneSlug: string;
  zoneTitle: string;
  zoneType: ZoneType;
  title: string | null;
  bodyExcerpt: string;
  commentCount: number;
  lastActivityAt: string;
}

/** Minimal public room data returned by global community search. */
export interface ForumZoneSearchResult {
  id: string;
  slug: string;
  title: string;
  type: ZoneType;
  description: string | null;
}

/** Active manual featured selection returned to the internal forum editor. */
export interface ForumFeaturedAdminView {
  threadId: string;
  featuredUntil: string;
  featuredBy: string | null;
  thread: ForumThreadSummary;
}

export interface ForumFeedContext {
  activeThreads: ForumThreadSummary[];
  suggestedThreads: ForumThreadSummary[];
}

export interface ForumFeed {
  items: ForumFeedItem[];
  nextCursor: string | null;
  context: ForumFeedContext;
}

export interface ForumHubView {
  featured: ForumFeedItem | null;
  continueDiscussions: ForumFeedItem[];
  trendingTags: Array<ForumTagView & { threadCount: number }>;
  supporters: ForumPublicPerson[];
  recommendedZones: ZoneView[];
}

export type ForumTrendScope = "relevant" | "exam" | "general";

export interface ForumTrendItem extends ForumTagView {
  threadCount: number;
}

export interface ForumTrendsView {
  items: ForumTrendItem[];
  scope: ForumTrendScope;
  examType: string | null;
  windowHours: number;
}

export interface ForumSearchView {
  threads: ForumThreadSummary[];
  questions: ForumThreadSummary[];
  zones: ForumZoneSearchResult[];
  tags: ForumTagView[];
  people: ForumPublicPerson[];
}

export interface ForumZoneFeedView {
  zone: ZoneView;
  feed: ThreadFeed;
  contributors: ForumPublicPerson[];
  pinnedThreads: ForumThreadSummary[];
}

/**
 * One entry in the "Saved" feed (APP-018 bookmarks) — a saved thread or a saved comment/answer,
 * discriminated by `type`, newest-saved first. Posts (comments + QA answers) both surface as
 * `CommentView` since they share the forum_posts row shape.
 */
export type SavedFeedItem =
  | { type: "thread"; thread: ThreadView }
  | { type: "comment"; comment: CommentView };

/** GET /v1/forum/bookmarks — cursor-paginated saved feed. */
export interface SavedFeed {
  items: SavedFeedItem[];
  nextCursor: string | null;
}

/**
 * One entry in a user's activity feed — a saved-feed item enriched with the zone it lives in, so the
 * profile can label "posted in {zone}" (activity spans zones, unlike a single zone's feed).
 */
export type ForumActivityItem = SavedFeedItem & { zone: { title: string; slug: string } };

/** GET /v1/forum/users/:username/activity — a user's threads + posts interleaved, newest first. */
export interface ForumActivityFeed {
  items: ForumActivityItem[];
  nextCursor: string | null;
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
  /** The zone the parent thread lives in (composer context, e.g. @mention autocomplete). */
  zoneId: string;
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
