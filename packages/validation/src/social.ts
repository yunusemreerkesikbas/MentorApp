import { z } from "zod";

/**
 * Follower/following list query — `before` = ISO createdAt of the last seen follow row (loads older).
 * Cursor-paginated (newest-follow first), like the forum saved feed.
 */
export const followListQuerySchema = z.object({
  before: z.string().datetime().optional(),
});
export type FollowListQuery = z.infer<typeof followListQuerySchema>;
