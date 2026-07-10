import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, getTableColumns, inArray, isNotNull, isNull, lt, notInArray, sql } from "drizzle-orm";
import { ZoneMemberStatus, ZoneType } from "@mentor/types";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database } from "../../../database/drizzle";
import { withServiceContext, withUserContext } from "../../../database/rls";
import {
  forumPosts,
  forumReactions,
  forumThreads,
  forumZoneMembers,
  forumZones,
  users,
} from "../../../database/schema";

/** A candidate for follow suggestions / cohort peers — public-safe identity fields. */
export interface SuggestedUserRow {
  userId: string;
  displayName: string;
  username: string;
  avatarStorageKey: string | null;
}

export type ThreadRow = typeof forumThreads.$inferSelect;
export type ThreadWithAuthor = ThreadRow & {
  authorName: string;
  authorUsername: string | null;
  authorAvatarStorageKey: string | null;
};
/** Author-listing row enriched with its zone (for the profile activity feed's "posted in X" label). */
export type ThreadWithAuthorAndZone = ThreadWithAuthor & { zoneTitle: string; zoneSlug: string };

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
  ): Promise<ThreadWithAuthor[]> {
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
        .select({
          ...getTableColumns(forumThreads),
          authorName: sql<string>`coalesce(${users.displayName}, '')`,
          authorUsername: sql<string | null>`${users.username}`,
          authorAvatarStorageKey: sql<string | null>`${users.avatarStorageKey}`,
        })
        .from(forumThreads)
        .leftJoin(users, eq(forumThreads.authorId, users.id))
        .where(and(...conds))
        .orderBy(desc(forumThreads.isPinned), desc(forumThreads.createdAt))
        .limit(opts.limit);
    });
  }

  /**
   * Popular feed: top `limit` threads by engagement score (reactions + non-deleted comments),
   * pinned first, newest as tiebreak. Single page — no cursor (popularity isn't monotonic in time).
   * ponytail: two correlated subqueries per row; fine for zone-sized feeds, revisit with a
   * denormalized counter if a zone ever holds tens of thousands of threads.
   */
  async listPopular(viewerId: string, zoneId: string, limit: number): Promise<ThreadWithAuthor[]> {
    return withUserContext(this.db, { userId: viewerId }, async (tx) => {
      const score = sql<number>`(
        (select count(*) from ${forumReactions} fr where fr.thread_id = ${forumThreads.id})
        + (select count(*) from ${forumPosts} fp where fp.thread_id = ${forumThreads.id} and fp.deleted_at is null)
      )`;
      return tx
        .select({
          ...getTableColumns(forumThreads),
          authorName: sql<string>`coalesce(${users.displayName}, '')`,
          authorUsername: sql<string | null>`${users.username}`,
          authorAvatarStorageKey: sql<string | null>`${users.avatarStorageKey}`,
        })
        .from(forumThreads)
        .leftJoin(users, eq(forumThreads.authorId, users.id))
        .where(and(eq(forumThreads.zoneId, zoneId), isNull(forumThreads.deletedAt)))
        .orderBy(desc(forumThreads.isPinned), desc(score), desc(forumThreads.createdAt))
        .limit(limit);
    });
  }

  async findById(threadId: string, viewerId: string): Promise<ThreadWithAuthor | null> {
    return withUserContext(this.db, { userId: viewerId }, async (tx) => {
      const [row] = await tx
        .select({
          ...getTableColumns(forumThreads),
          authorName: sql<string>`coalesce(${users.displayName}, '')`,
          authorUsername: sql<string | null>`${users.username}`,
          authorAvatarStorageKey: sql<string | null>`${users.avatarStorageKey}`,
        })
        .from(forumThreads)
        .leftJoin(users, eq(forumThreads.authorId, users.id))
        .where(eq(forumThreads.id, threadId))
        .limit(1);
      return row ?? null;
    });
  }

  /** A user's own threads, newest first (for their profile). `before` (ISO createdAt) loads older. */
  async listByAuthor(
    authorId: string,
    viewerId: string,
    opts: { limit: number; before?: string },
  ): Promise<ThreadWithAuthorAndZone[]> {
    return withUserContext(this.db, { userId: viewerId }, async (tx) => {
      const conds = [eq(forumThreads.authorId, authorId), isNull(forumThreads.deletedAt)];
      if (opts.before) conds.push(lt(forumThreads.createdAt, new Date(opts.before)));
      return tx
        .select({
          ...getTableColumns(forumThreads),
          authorName: sql<string>`coalesce(${users.displayName}, '')`,
          authorUsername: sql<string | null>`${users.username}`,
          authorAvatarStorageKey: sql<string | null>`${users.avatarStorageKey}`,
          zoneTitle: sql<string>`coalesce(${forumZones.title}, '')`,
          zoneSlug: sql<string>`coalesce(${forumZones.slug}, '')`,
        })
        .from(forumThreads)
        .leftJoin(users, eq(forumThreads.authorId, users.id))
        .leftJoin(forumZones, eq(forumThreads.zoneId, forumZones.id))
        .where(and(...conds))
        .orderBy(desc(forumThreads.createdAt))
        .limit(opts.limit);
    });
  }

  /**
   * Threads authored by any of `authorIds`, newest first (cross-zone "Akış" feed). `withUserContext`
   * RLS elides deleted threads + threads in zones the viewer can't see, so visibility comes for free.
   * Empty author set → []. `before` (ISO createdAt) loads older.
   */
  async listByAuthorIds(
    authorIds: string[],
    viewerId: string,
    opts: { limit: number; before?: string },
  ): Promise<ThreadWithAuthor[]> {
    if (authorIds.length === 0) return [];
    return withUserContext(this.db, { userId: viewerId }, async (tx) => {
      const conds = [inArray(forumThreads.authorId, authorIds), isNull(forumThreads.deletedAt)];
      if (opts.before) conds.push(lt(forumThreads.createdAt, new Date(opts.before)));
      return tx
        .select({
          ...getTableColumns(forumThreads),
          authorName: sql<string>`coalesce(${users.displayName}, '')`,
          authorUsername: sql<string | null>`${users.username}`,
          authorAvatarStorageKey: sql<string | null>`${users.avatarStorageKey}`,
        })
        .from(forumThreads)
        .leftJoin(users, eq(forumThreads.authorId, users.id))
        .where(and(...conds))
        .orderBy(desc(forumThreads.createdAt))
        .limit(opts.limit);
    });
  }

  /** Visible threads for a set of ids (RLS hides deleted/hidden for the viewer). Order not guaranteed. */
  async findManyByIds(threadIds: string[], viewerId: string): Promise<ThreadWithAuthor[]> {
    if (threadIds.length === 0) return [];
    return withUserContext(this.db, { userId: viewerId }, async (tx) =>
      tx
        .select({
          ...getTableColumns(forumThreads),
          authorName: sql<string>`coalesce(${users.displayName}, '')`,
          authorUsername: sql<string | null>`${users.username}`,
          authorAvatarStorageKey: sql<string | null>`${users.avatarStorageKey}`,
        })
        .from(forumThreads)
        .leftJoin(users, eq(forumThreads.authorId, users.id))
        .where(inArray(forumThreads.id, threadIds)),
    );
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
  ): Promise<{ items: ThreadWithAuthor[]; total: number }> {
    return withUserContext(this.db, { userId: viewerId }, async (tx) => {
      const match = sql`to_tsvector('turkish', coalesce(${forumThreads.title}, '') || ' ' || ${forumThreads.body}) @@ websearch_to_tsquery('turkish', ${opts.q})`;
      const conds = [eq(forumZones.type, ZoneType.QA), isNull(forumThreads.deletedAt), match];
      if (opts.zoneSlug) conds.push(eq(forumZones.slug, opts.zoneSlug));
      const where = and(...conds);
      const items = await tx
        .select({
          ...getTableColumns(forumThreads),
          authorName: sql<string>`coalesce(${users.displayName}, '')`,
          authorUsername: sql<string | null>`${users.username}`,
          authorAvatarStorageKey: sql<string | null>`${users.avatarStorageKey}`,
        })
        .from(forumThreads)
        .innerJoin(forumZones, eq(forumThreads.zoneId, forumZones.id))
        .leftJoin(users, eq(forumThreads.authorId, users.id))
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

  /** Batched: non-deleted comment/answer count per thread (one query, service context). */
  async commentCountsByThread(threadIds: string[]): Promise<Map<string, number>> {
    if (threadIds.length === 0) return new Map();
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx
        .select({
          threadId: forumPosts.threadId,
          count: sql<number>`count(*)::int`,
        })
        .from(forumPosts)
        .where(and(inArray(forumPosts.threadId, threadIds), isNull(forumPosts.deletedAt)))
        .groupBy(forumPosts.threadId);
      const map = new Map<string, number>();
      for (const r of rows) map.set(r.threadId, r.count);
      return map;
    });
  }

  /**
   * Batched: up to `perThread` recent distinct commenter names per thread (for the replier-avatar
   * cluster). DISTINCT ON dedupes authors keeping their latest comment; JS then ranks + trims.
   */
  async recentCommentersByThread(
    threadIds: string[],
    perThread = 3,
  ): Promise<Map<string, string[]>> {
    if (threadIds.length === 0) return new Map();
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx
        .selectDistinctOn([forumPosts.threadId, forumPosts.authorId], {
          threadId: forumPosts.threadId,
          authorName: sql<string>`coalesce(${users.displayName}, '')`,
          authorUsername: sql<string | null>`${users.username}`,
          createdAt: forumPosts.createdAt,
        })
        .from(forumPosts)
        .leftJoin(users, eq(forumPosts.authorId, users.id))
        .where(and(inArray(forumPosts.threadId, threadIds), isNull(forumPosts.deletedAt)))
        .orderBy(forumPosts.threadId, forumPosts.authorId, desc(forumPosts.createdAt));
      const byThread = new Map<string, { name: string; at: Date }[]>();
      for (const r of rows) {
        const arr = byThread.get(r.threadId) ?? [];
        arr.push({ name: r.authorName, at: r.createdAt });
        byThread.set(r.threadId, arr);
      }
      const map = new Map<string, string[]>();
      for (const [threadId, arr] of byThread) {
        arr.sort((a, b) => b.at.getTime() - a.at.getTime());
        map.set(threadId, arr.slice(0, perThread).map((x) => x.name));
      }
      return map;
    });
  }

  /**
   * Follow suggestions (forum-native): distinct recent thread authors in zones where the viewer is an
   * ACTIVE member, excluding `excludeIds` (self + already-followed) and handle-less users. One row per
   * author (their newest thread), then sorted by recency in JS and capped. SERVICE context — the
   * membership join scopes it to the viewer's own zones (no cross-zone leak).
   * ponytail: `notInArray` grows with follow count; fine at MVP scale, not a hot path.
   */
  async suggestAuthorsInMemberZones(
    viewerId: string,
    excludeIds: string[],
    limit: number,
  ): Promise<SuggestedUserRow[]> {
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx
        .selectDistinctOn([forumThreads.authorId], {
          userId: users.id,
          displayName: sql<string>`coalesce(${users.displayName}, '')`,
          username: sql<string>`${users.username}`,
          avatarStorageKey: sql<string | null>`${users.avatarStorageKey}`,
          createdAt: forumThreads.createdAt,
        })
        .from(forumThreads)
        .innerJoin(
          forumZoneMembers,
          and(
            eq(forumZoneMembers.zoneId, forumThreads.zoneId),
            eq(forumZoneMembers.userId, viewerId),
            eq(forumZoneMembers.status, ZoneMemberStatus.ACTIVE),
          ),
        )
        .innerJoin(users, eq(users.id, forumThreads.authorId))
        .where(
          and(
            isNull(forumThreads.deletedAt),
            isNotNull(users.username),
            notInArray(forumThreads.authorId, excludeIds),
          ),
        )
        .orderBy(forumThreads.authorId, desc(forumThreads.createdAt));
      return rows
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, limit)
        .map(({ createdAt: _createdAt, ...u }) => u);
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

  // --- Public (SEO) reads: service-context, hard-filtered to INDEXABLE QA questions ---
  // Indexable = QA zone, PUBLIC, not archived, thread not deleted, AND has ≥1 non-deleted answer.

  private indexableWhere() {
    return and(
      eq(forumZones.type, ZoneType.QA),
      eq(forumZones.visibility, "PUBLIC"),
      eq(forumZones.isArchived, false),
      isNull(forumThreads.deletedAt),
      sql`EXISTS (SELECT 1 FROM forum_posts fp WHERE fp.thread_id = ${forumThreads.id} AND fp.deleted_at IS NULL)`,
    );
  }

  /** A single indexable QA question (or null). */
  async findPublicQuestion(threadId: string): Promise<ThreadRow | null> {
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx
        .select(getTableColumns(forumThreads))
        .from(forumThreads)
        .innerJoin(forumZones, eq(forumThreads.zoneId, forumZones.id))
        .where(and(eq(forumThreads.id, threadId), this.indexableWhere()))
        .limit(1);
      return rows[0] ?? null;
    });
  }

  /** Indexable QA questions for the sitemap (id + updatedAt, newest-updated first). */
  async listPublicQuestionRefs(limit: number): Promise<{ id: string; updatedAt: Date }[]> {
    return withServiceContext(this.db, async (tx) => {
      return tx
        .select({ id: forumThreads.id, updatedAt: forumThreads.updatedAt })
        .from(forumThreads)
        .innerJoin(forumZones, eq(forumThreads.zoneId, forumZones.id))
        .where(this.indexableWhere())
        .orderBy(desc(forumThreads.updatedAt))
        .limit(limit);
    });
  }
}
