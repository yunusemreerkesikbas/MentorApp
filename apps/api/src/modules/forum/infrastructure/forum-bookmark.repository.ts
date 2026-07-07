import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, inArray, lt } from "drizzle-orm";
import type { ModerationTargetType } from "@mentor/types";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database } from "../../../database/drizzle";
import { withServiceContext } from "../../../database/rls";
import { forumBookmarks } from "../../../database/schema";

export type BookmarkRow = typeof forumBookmarks.$inferSelect;

/**
 * Per-user saved posts (APP-018). Polymorphic target (THREAD | POST), mirroring the reaction toggle
 * pattern. Writes/reads run in SERVICE context (trusted, own-user scoped by the WHERE clause).
 */
@Injectable()
export class ForumBookmarkRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /** Save a target (idempotent — a repeated bookmark is a no-op). */
  async add(userId: string, targetType: ModerationTargetType, targetId: string): Promise<void> {
    await withServiceContext(this.db, (tx) =>
      tx.insert(forumBookmarks).values({ userId, targetType, targetId }).onConflictDoNothing(),
    );
  }

  /** Remove a saved target (no-op if not saved). */
  async remove(userId: string, targetType: ModerationTargetType, targetId: string): Promise<void> {
    await withServiceContext(this.db, (tx) =>
      tx
        .delete(forumBookmarks)
        .where(
          and(
            eq(forumBookmarks.userId, userId),
            eq(forumBookmarks.targetType, targetType),
            eq(forumBookmarks.targetId, targetId),
          ),
        ),
    );
  }

  /** Batched: which of these targets the viewer has bookmarked (one query, no N+1). */
  async myBookmarkedTargets(
    targetType: ModerationTargetType,
    targetIds: string[],
    userId: string,
  ): Promise<Set<string>> {
    if (targetIds.length === 0) return new Set();
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx
        .select({ targetId: forumBookmarks.targetId })
        .from(forumBookmarks)
        .where(
          and(
            eq(forumBookmarks.userId, userId),
            eq(forumBookmarks.targetType, targetType),
            inArray(forumBookmarks.targetId, targetIds),
          ),
        );
      return new Set(rows.map((r) => r.targetId));
    });
  }

  /** A user's saved rows, newest first, cursor-paginated on createdAt. */
  async listForUser(userId: string, opts: { before?: Date; limit: number }): Promise<BookmarkRow[]> {
    return withServiceContext(this.db, (tx) => {
      const conds = [eq(forumBookmarks.userId, userId)];
      if (opts.before) conds.push(lt(forumBookmarks.createdAt, opts.before));
      return tx
        .select()
        .from(forumBookmarks)
        .where(and(...conds))
        .orderBy(desc(forumBookmarks.createdAt))
        .limit(opts.limit);
    });
  }
}
