/**
 * Forum schemas (Phase-2 pulled into MVP) — shared FE+BE (§8). User-facing copy localized by the backend.
 */
import { z } from "zod";
import {
  FORUM_ATTACHMENT_MIMES,
  FORUM_MAX_ATTACHMENTS,
  FORUM_REACTION_EMOJIS,
  ForumCoachIntent,
  ModerationTargetType,
  ReportReason,
  ReportStatus,
  ZoneJoinPolicy,
  ZoneMemberStatus,
  ZoneType,
} from "@mentor/types";
import { paginationQuerySchema } from "./pagination.js";

/** Staff-only zone creation (curated). Slug is derived server-side, not accepted from the client. */
export const createZoneSchema = z.object({
  type: z.nativeEnum(ZoneType),
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000).optional(),
  examType: z.string().trim().max(32).optional(),
  emoji: z.string().trim().max(8).optional(),
  joinPolicy: z.nativeEnum(ZoneJoinPolicy).default(ZoneJoinPolicy.OPEN),
});
export type CreateZone = z.infer<typeof createZoneSchema>;

/** Assign an external user as the zone OWNER (curated onboarding of a community leader). */
export const assignOwnerSchema = z.object({ userId: z.string().uuid() });
export type AssignOwner = z.infer<typeof assignOwnerSchema>;

/** Owner/mod decision on a pending join request. */
export const approveMemberSchema = z.object({ approve: z.boolean() });
export type ApproveMember = z.infer<typeof approveMemberSchema>;

export const zoneListQuerySchema = paginationQuerySchema.extend({
  type: z.nativeEnum(ZoneType).optional(),
  examType: z.string().trim().max(32).optional(),
});
export type ZoneListQuery = z.infer<typeof zoneListQuerySchema>;

/** Filter the member list (owner/mod) — typically `PENDING` to review join requests. */
export const zoneMembersQuerySchema = z.object({
  status: z.nativeEnum(ZoneMemberStatus).optional(),
});
export type ZoneMembersQuery = z.infer<typeof zoneMembersQuerySchema>;

/** Request a presigned upload URL for a post attachment (image or file — APP-027). */
export const attachmentUploadUrlSchema = z.object({
  contentType: z.enum(FORUM_ATTACHMENT_MIMES),
});
export type AttachmentUploadUrl = z.infer<typeof attachmentUploadUrlSchema>;

/**
 * One attachment reference sent when creating a post: the storage `key` returned by the upload-url
 * endpoint (ownership re-verified server-side) + its mime, client-measured pixel size (images), and
 * original filename (files, for the download chip label).
 */
export const attachmentInputSchema = z.object({
  key: z.string().trim().min(1).max(300),
  mimeType: z.enum(FORUM_ATTACHMENT_MIMES),
  width: z.number().int().positive().max(20000).optional(),
  height: z.number().int().positive().max(20000).optional(),
  fileName: z.string().trim().min(1).max(255).optional(),
});
export type AttachmentInput = z.infer<typeof attachmentInputSchema>;

const attachmentsField = z.array(attachmentInputSchema).max(FORUM_MAX_ATTACHMENTS).optional();
const forumTagIdsField = z.array(z.string().uuid()).max(3).optional();

/**
 * Post a thread. CHAT/ANNOUNCEMENT use body only; a QA question also carries a `title` (the
 * service requires a non-empty title when the zone is QA and rejects it otherwise). Optional image
 * attachments (max 4) — QA zones ignore them (attachments land on chat/announcement posts, APP-018).
 */
export const createThreadSchema = z.object({
  body: z.string().trim().min(1).max(4000),
  title: z.string().trim().min(5).max(200).optional(),
  attachments: attachmentsField,
  tagIds: forumTagIdsField,
});
export type CreateThread = z.infer<typeof createThreadSchema>;

/** Post an answer/comment. Optional image attachments (max 4) — used by comments/replies (APP-018). */
export const createAnswerSchema = z.object({
  body: z.string().trim().min(1).max(4000),
  attachments: attachmentsField,
});
export type CreateAnswer = z.infer<typeof createAnswerSchema>;

/**
 * @mention autocomplete over a zone's ACTIVE members (APP-021). `q` is a username prefix —
 * handle-charset only, so it can be interpolated into a LIKE prefix without wildcard escaping.
 */
export const memberSearchQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .toLowerCase()
    .min(1)
    .max(24)
    .regex(/^[a-z0-9_]+$/),
});
export type MemberSearchQuery = z.infer<typeof memberSearchQuerySchema>;

/** Full-text search over QA questions (title + body). Offset-paginated. */
export const searchQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().min(2).max(120),
  zone: z.string().trim().max(80).optional(),
});
export type SearchQuery = z.infer<typeof searchQuerySchema>;

/**
 * Feed query. `recent` = cursor feed (`before` = ISO createdAt of the last seen item, loads older);
 * `popular` = top items by like+comment score (single page, no deep pagination).
 */
export const feedQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(30),
  before: z.string().datetime().optional(),
  sort: z.enum(["recent", "popular"]).default("recent"),
});
export type FeedQuery = z.infer<typeof feedQuerySchema>;

/** Cross-zone discovery feed. Cursor contents are decoded and validated by the forum domain. */
export const forumFeedQuerySchema = z.object({
  scope: z.enum(["relevant", "following"]).default("relevant"),
  sort: z.enum(["trending", "recent", "top"]).default("trending"),
  tag: z.string().trim().min(1).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  zoneType: z.nativeEnum(ZoneType).optional(),
  cursor: z.string().trim().min(1).max(1000).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type ForumFeedQuery = z.infer<typeof forumFeedQuerySchema>;

export const forumTrendsQuerySchema = z.object({
  scope: z.enum(["relevant", "exam", "general"]).default("relevant"),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type ForumTrendsQuery = z.infer<typeof forumTrendsQuerySchema>;

/** Global discovery search returns at most five threads, tags, and public-safe people per group. */
export const forumSearchQuerySchema = z.object({
  q: z.string().trim().min(2).max(120),
});
export type ForumSearchQuery = z.infer<typeof forumSearchQuerySchema>;

export const updateForumThreadSchema = z
  .object({
    body: z.string().trim().min(1).max(4000).optional(),
    title: z.string().trim().min(5).max(200).nullable().optional(),
    tagIds: forumTagIdsField,
  })
  .refine(
    (value) =>
      value.body !== undefined || value.title !== undefined || value.tagIds !== undefined,
    { message: "At least one field is required" },
  );
export type UpdateForumThread = z.infer<typeof updateForumThreadSchema>;

export const updateForumPostSchema = z.object({
  body: z.string().trim().min(1).max(4000),
});
export type UpdateForumPost = z.infer<typeof updateForumPostSchema>;

const forumTagSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const adminForumTagCreateSchema = z.object({
  slug: forumTagSlugSchema,
  nameTr: z.string().trim().min(2).max(80),
  nameEn: z.string().trim().min(2).max(80),
  examType: z.string().trim().max(32).nullable().optional(),
  isActive: z.boolean().default(true),
  coachIntent: z.nativeEnum(ForumCoachIntent).nullable().optional(),
});
export type AdminForumTagCreate = z.infer<typeof adminForumTagCreateSchema>;

export const adminForumTagUpdateSchema = adminForumTagCreateSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: "At least one field is required" });
export type AdminForumTagUpdate = z.infer<typeof adminForumTagUpdateSchema>;

export const setFeaturedThreadSchema = z.object({
  threadId: z.string().uuid(),
  featuredUntil: z.string().datetime().optional(),
});
export type SetFeaturedThread = z.infer<typeof setFeaturedThreadSchema>;

/** Saved feed query — `before` = ISO createdAt of the last saved item (loads older). */
export const bookmarkQuerySchema = z.object({
  before: z.string().datetime().optional(),
});
export type BookmarkQuery = z.infer<typeof bookmarkQuerySchema>;

/** Add/remove a reaction — emoji must be one of the fixed allowed set. */
export const reactionSchema = z.object({
  emoji: z.enum(FORUM_REACTION_EMOJIS),
});
export type Reaction = z.infer<typeof reactionSchema>;

/** Pin/unpin a thread (owner/mod). */
export const pinThreadSchema = z.object({ pinned: z.boolean() });
export type PinThread = z.infer<typeof pinThreadSchema>;

/** Report a thread or answer (slice 5). Any authed user who can see the target. */
export const createReportSchema = z.object({
  targetType: z.nativeEnum(ModerationTargetType),
  targetId: z.string().uuid(),
  reason: z.nativeEnum(ReportReason),
  note: z.string().trim().max(500).optional(),
});
export type CreateReport = z.infer<typeof createReportSchema>;

/** Moderation queue filter (owner/mod or staff). */
export const reportsQuerySchema = paginationQuerySchema.extend({
  status: z.nativeEnum(ReportStatus).optional(),
});
export type ReportsQuery = z.infer<typeof reportsQuerySchema>;

/** Resolve a report: hide the content (soft-delete) or dismiss the report. */
export const resolveReportSchema = z.object({
  action: z.enum(["HIDE", "DISMISS"]),
});
export type ResolveReport = z.infer<typeof resolveReportSchema>;
