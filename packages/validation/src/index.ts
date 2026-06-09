/**
 * @mentor/validation — Zod schemas (single source for FE+BE, §8).
 *
 * NOTE: Feature schemas (mock-analysis input, onboarding, etc.) will be added
 * later. For now, only common/skeleton schemas.
 */
import { z } from "zod";

/** Pagination query params — shared by all list endpoints. */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export * from "./auth.js";

export { z };
