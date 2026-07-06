/**
 * Forum schemas (Phase-2 pulled into MVP) — shared FE+BE (§8). User-facing copy localized by the backend.
 */
import { z } from "zod";
import {
  FORUM_IMAGE_MIMES,
  FORUM_MAX_ATTACHMENTS,
  FORUM_REACTION_EMOJIS,
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

/** Request a presigned upload URL for a post image (Phase 1). */
export const attachmentUploadUrlSchema = z.object({
  contentType: z.enum(FORUM_IMAGE_MIMES),
});
export type AttachmentUploadUrl = z.infer<typeof attachmentUploadUrlSchema>;

/**
 * One attachment reference sent when creating a post: the storage `key` returned by the upload-url
 * endpoint (ownership re-verified server-side) + its mime and client-measured pixel size (for layout).
 */
export const attachmentInputSchema = z.object({
  key: z.string().trim().min(1).max(300),
  mimeType: z.enum(FORUM_IMAGE_MIMES),
  width: z.number().int().positive().max(20000).optional(),
  height: z.number().int().positive().max(20000).optional(),
});
export type AttachmentInput = z.infer<typeof attachmentInputSchema>;

const attachmentsField = z.array(attachmentInputSchema).max(FORUM_MAX_ATTACHMENTS).optional();

/**
 * Post a thread. CHAT/ANNOUNCEMENT use body only; a QA question also carries a `title` (the
 * service requires a non-empty title when the zone is QA and rejects it otherwise). Optional image
 * attachments (max 4) — QA zones ignore them (attachments land on chat/announcement posts, APP-018).
 */
export const createThreadSchema = z.object({
  body: z.string().trim().min(1).max(4000),
  title: z.string().trim().min(5).max(200).optional(),
  attachments: attachmentsField,
});
export type CreateThread = z.infer<typeof createThreadSchema>;

/** Post an answer/comment. Optional image attachments (max 4) — used by comments/replies (APP-018). */
export const createAnswerSchema = z.object({
  body: z.string().trim().min(1).max(4000),
  attachments: attachmentsField,
});
export type CreateAnswer = z.infer<typeof createAnswerSchema>;

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
