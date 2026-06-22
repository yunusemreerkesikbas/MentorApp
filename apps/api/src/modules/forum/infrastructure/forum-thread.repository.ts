import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, getTableColumns, inArray, isNull, lt, sql } from "drizzle-orm";
import { ZoneType } from "@mentor/types";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database } from "../../../database/drizzle";
import { withServiceContext, withUserContext } from "../../../database/rls";
import { forumReactions, forumThreads, forumZones } from "../../../database/schema";

export type ThreadRow = typeof forumThreads.$inferSelect;

/**
 * Feed-thread + reaction access (Slice 2). Reads run in user context (RLS belt: non-deleted +
 * own reactions); privileged writes and cross-user aggregates (reaction counts) run in SERVICE
 * context — mirrors ForumZoneRepository. Zone visibility/membership is checked one layer up.
 */
@Injectable()
export class ForumThreadRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async createThread(input: {
    zoneId: string;
    authorId: string;
    body: string;
    title?: string | null;
  }): Promise<ThreadRow> {
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx
        .insert(forumThreads)
        .values({
          zoneId: input.zoneId,
          authorId: input.authorId,
          body: input.body,
          title: input.title ?? null,
        })
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

  /** Reverse a hide (moderation RESTORE). */
  async restore(threadId: string): Promise<void> {
    await withServiceContext(this.db, async (tx) => {
      await tx
        .update(forumThreads)
        .set({ deletedAt: null, deletedBy: null, updatedAt: new Date() })
        .where(eq(forumThreads.id, threadId));
    });
  }

  /** Service-context fetch incl. soft-deleted rows (for restore — RLS user-read hides them). */
  async findByIdIncludingDeleted(threadId: string): Promise<ThreadRow | null> {
    return withServiceContext(this.db, async (tx) => {
      const [row] = await tx.select().from(forumThreads).where(eq(forumThreads.id, threadId)).limit(1);
      return row ?? null;
    });
  }

  /**
   * QA: atomically claim the accepted answer + close the question (one-shot). The `accepted_post_id
   * IS NULL` guard makes check-and-set a single statement, so concurrent accepts can't both win
   * (no TOCTOU double-grant). Returns true iff this call did the claim.
   */
  async setQaAccepted(threadId: string, postId: string): Promise<boolean> {
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx
        .update(forumThreads)
        .set({ acceptedPostId: postId, status: "ANSWERED", updatedAt: new Date() })
        .where(and(eq(forumThreads.id, threadId), isNull(forumThreads.acceptedPostId)))
        .returning({ id: forumThreads.id });
      return rows.length > 0;
    });
  }

  /**
   * Full-text search over QA questions (title + body) via the expression GIN index. User-context →
   * RLS limits to visible (PUBLIC, non-archived) QA zones + non-deleted threads. Ranked by relevance.
   */
  async searchQuestions(
    viewerId: string,
    opts: { q: string; zoneSlug?: string; page: number; pageSize: number },
  ): Promise<{ items: ThreadRow[]; total: number }> {
    return withUserContext(this.db, { userId: viewerId }, async (tx) => {
      const match = sql`to_tsvector('turkish', coalesce(${forumThreads.title}, '') || ' ' || ${forumThreads.body}) @@ websearch_to_tsquery('turkish', ${opts.q})`;
      const conds = [eq(forumZones.type, ZoneType.QA), isNull(forumThreads.deletedAt), match];
      if (opts.zoneSlug) conds.push(eq(forumZones.slug, opts.zoneSlug));
      const where = and(...conds);
      const items = await tx
        .select(getTableColumns(forumThreads))
        .from(forumThreads)
        .innerJoin(forumZones, eq(forumThreads.zoneId, forumZones.id))
        .where(where)
        .orderBy(
          desc(
            sql`ts_rank(to_tsvector('turkish', coalesce(${forumThreads.title}, '') || ' ' || ${forumThreads.body}), websearch_to_tsquery('turkish', ${opts.q}))`,
          ),
        )
        .limit(opts.pageSize)
        .offset((opts.page - 1) * opts.pageSize);
      const countRows = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(forumThreads)
        .innerJoin(forumZones, eq(forumThreads.zoneId, forumZones.id))
        .where(where);
      return { items, total: countRows[0]?.count ?? 0 };
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
