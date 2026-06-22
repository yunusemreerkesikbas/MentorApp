import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, inArray, isNull, lt, sql } from "drizzle-orm";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database } from "../../../database/drizzle";
import { withServiceContext, withUserContext } from "../../../database/rls";
import { forumReactions, forumThreads } from "../../../database/schema";

export type ThreadRow = typeof forumThreads.$inferSelect;

/**
 * Feed-thread + reaction access (Slice 2). Reads run in user context (RLS belt: non-deleted +
 * own reactions); privileged writes and cross-user aggregates (reaction counts) run in SERVICE
 * context — mirrors ForumZoneRepository. Zone visibility/membership is checked one layer up.
 */
@Injectable()
export class ForumThreadRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async createThread(input: { zoneId: string; authorId: string; body: string }): Promise<ThreadRow> {
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx
        .insert(forumThreads)
        .values({ zoneId: input.zoneId, authorId: input.authorId, body: input.body })
        .returning();
      return rows[0]!;
    });
  }

  /** Newest-first feed (pinned on top), `limit` rows; `before` (ISO createdAt) loads older. */
  async listFeed(
    viewerId: string,
    zoneId: string,
    opts: { limit: number; before?: string },
  ): Promise<ThreadRow[]> {
    return withUserContext(this.db, { userId: viewerId }, async (tx) => {
      const conds = [eq(forumThreads.zoneId, zoneId), isNull(forumThreads.deletedAt)];
      if (opts.before) {
        // Pinned items live on the first (no-cursor) page only; excluding them on cursor pages
        // prevents an old pinned thread from re-floating to the top of every subsequent page.
        // ponytail: assumes #pins <= limit (pins are few); revisit if a zone needs many pins.
        conds.push(lt(forumThreads.createdAt, new Date(opts.before)));
        conds.push(eq(forumThreads.isPinned, false));
      }
      return tx
        .select()
        .from(forumThreads)
        .where(and(...conds))
        .orderBy(desc(forumThreads.isPinned), desc(forumThreads.createdAt))
        .limit(opts.limit);
    });
  }

  async findById(threadId: string, viewerId: string): Promise<ThreadRow | null> {
    return withUserContext(this.db, { userId: viewerId }, async (tx) => {
      const [row] = await tx
        .select()
        .from(forumThreads)
        .where(eq(forumThreads.id, threadId))
        .limit(1);
      return row ?? null;
    });
  }

  async setPinned(threadId: string, pinned: boolean): Promise<void> {
    await withServiceContext(this.db, async (tx) => {
      await tx
        .update(forumThreads)
        .set({ isPinned: pinned, updatedAt: new Date() })
        .where(eq(forumThreads.id, threadId));
    });
  }

  async softDelete(threadId: string, byUserId: string): Promise<void> {
    await withServiceContext(this.db, async (tx) => {
      await tx
        .update(forumThreads)
        .set({ deletedAt: new Date(), deletedBy: byUserId, updatedAt: new Date() })
        .where(eq(forumThreads.id, threadId));
    });
  }

  async addReaction(threadId: string, userId: string, emoji: string): Promise<void> {
    await withServiceContext(this.db, async (tx) => {
      await tx.insert(forumReactions).values({ threadId, userId, emoji }).onConflictDoNothing();
    });
  }

  async removeReaction(threadId: string, userId: string, emoji: string): Promise<void> {
    await withServiceContext(this.db, async (tx) => {
      await tx
        .delete(forumReactions)
        .where(
          and(
            eq(forumReactions.threadId, threadId),
            eq(forumReactions.userId, userId),
            eq(forumReactions.emoji, emoji),
          ),
        );
    });
  }

  /** Batched emoji→count per thread (one query — no N+1). */
  async reactionCountsByThread(threadIds: string[]): Promise<Map<string, Record<string, number>>> {
    if (threadIds.length === 0) return new Map();
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx
        .select({
          threadId: forumReactions.threadId,
          emoji: forumReactions.emoji,
          count: sql<number>`count(*)::int`,
        })
        .from(forumReactions)
        .where(inArray(forumReactions.threadId, threadIds))
        .groupBy(forumReactions.threadId, forumReactions.emoji);
      const map = new Map<string, Record<string, number>>();
      for (const r of rows) {
        const entry = map.get(r.threadId) ?? {};
        entry[r.emoji] = r.count;
        map.set(r.threadId, entry);
      }
      return map;
    });
  }

  /** Batched: which emojis the viewer themselves reacted with, per thread (one query). */
  async myReactionsByThread(threadIds: string[], userId: string): Promise<Map<string, string[]>> {
    if (threadIds.length === 0) return new Map();
    return withUserContext(this.db, { userId }, async (tx) => {
      const rows = await tx
        .select({ threadId: forumReactions.threadId, emoji: forumReactions.emoji })
        .from(forumReactions)
        .where(and(inArray(forumReactions.threadId, threadIds), eq(forumReactions.userId, userId)));
      const map = new Map<string, string[]>();
      for (const r of rows) {
        const arr = map.get(r.threadId) ?? [];
        arr.push(r.emoji);
        map.set(r.threadId, arr);
      }
      return map;
    });
  }
}
