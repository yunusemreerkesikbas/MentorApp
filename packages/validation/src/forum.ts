/**
 * Forum schemas (Phase-2 pulled into MVP) — shared FE+BE (§8). User-facing copy localized by the backend.
 */
import { z } from "zod";
import { FORUM_REACTION_EMOJIS, ZoneJoinPolicy, ZoneMemberStatus, ZoneType } from "@mentor/types";
import { paginationQuerySchema } from "./pagination.js";

/** Staff-only zone creation (curated). Slug is derived server-side, not accepted from the client. */
export const createZoneSchema = z.object({
  type: z.nativeEnum(ZoneType),
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000).optional(),
  examType: z.string().trim().max(32).optional(),
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

/**
 * Post a thread. CHAT/ANNOUNCEMENT use body only; a QA question also carries a `title` (the
 * service requires a non-empty title when the zone is QA and rejects it otherwise).
 */
export const createThreadSchema = z.object({
  body: z.string().trim().min(1).max(4000),
  title: z.string().trim().min(5).max(200).optional(),
});
export type CreateThread = z.infer<typeof createThreadSchema>;

/** Post an answer to a QA question. */
export const createAnswerSchema = z.object({
  body: z.string().trim().min(1).max(4000),
});
export type CreateAnswer = z.infer<typeof createAnswerSchema>;

/** Full-text search over QA questions (title + body). Offset-paginated. */
export const searchQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().min(2).max(120),
  zone: z.string().trim().max(80).optional(),
});
export type SearchQuery = z.infer<typeof searchQuerySchema>;

/** Cursor feed query. `before` = ISO createdAt of the last seen item (load older). */
export const feedQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(30),
  before: z.string().datetime().optional(),
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
