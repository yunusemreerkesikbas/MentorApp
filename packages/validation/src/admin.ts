/**
 * Admin schemas (W6 — admin panel) — shared FE+BE (§8 single validation source).
 * User-facing copy is NOT here: messages are localized by the backend.
 */
import { z } from "zod";
// NOTE: import from the leaf module, NOT "./index.js" — a barrel import here would
// create an index↔admin cycle that crashes sync ESM-from-CJS loading (see payments gotcha).
import { paginationQuerySchema } from "./pagination.js";

/** User search/list for admin management (paginated; optional free-text query). */
export const searchUsersQuerySchema = paginationQuerySchema.extend({
  /** Matches email or display name (case-insensitive, partial). */
  q: z.string().trim().min(1).max(120).optional(),
});
export type SearchUsersQuery = z.infer<typeof searchUsersQuerySchema>;

/** Audit-log listing (paginated). */
export const auditLogQuerySchema = paginationQuerySchema;
export type AuditLogQuery = z.infer<typeof auditLogQuerySchema>;

/** Graduated account status (§9): admin can suspend/ban or reactivate. */
export const USER_STATUSES = ["ACTIVE", "SUSPENDED", "BANNED"] as const;
export const userStatusSchema = z.enum(USER_STATUSES);
export type UserStatusValue = z.infer<typeof userStatusSchema>;

export const updateUserStatusSchema = z.object({ status: userStatusSchema });
export type UpdateUserStatus = z.infer<typeof updateUserStatusSchema>;

/** Config override write. The value is validated server-side against the key's catalog schema. */
export const updateConfigSchema = z.object({ value: z.unknown() });
export type UpdateConfig = z.infer<typeof updateConfigSchema>;

/* ---------------------------- Announcements (broadcast) --------------------------- */

/** Who a broadcast reaches. Resolved server-side against ACTIVE users only. */
export const announcementAudienceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("ALL") }),
  z.object({ kind: z.literal("EXAM_TYPE"), examType: z.enum(["KPSS", "YKS", "LGS"]) }),
]);
export type AnnouncementAudienceInput = z.infer<typeof announcementAudienceSchema>;

/**
 * `linkUrl` MUST stay an internal path: the web drawer does `router.push(linkUrl)` without
 * validating it, so an absolute URL here would be a stored open-redirect. `^\/(?!\/)` rejects
 * schemes ("https://…") and protocol-relative targets ("//evil.com") alike.
 */
export const createAnnouncementSchema = z.object({
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(500),
  linkUrl: z
    .string()
    .trim()
    .max(2048)
    .regex(/^\/(?!\/)/, "linkUrl must be an internal path starting with a single '/'.")
    .optional(),
  audience: announcementAudienceSchema,
});
export type CreateAnnouncement = z.infer<typeof createAnnouncementSchema>;

/** Omit `scheduledAt` to fan out immediately; otherwise it becomes the job's `runAt`. */
export const sendAnnouncementSchema = z.object({
  scheduledAt: z.string().datetime().optional(),
});
export type SendAnnouncement = z.infer<typeof sendAnnouncementSchema>;
