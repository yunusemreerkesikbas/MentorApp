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
