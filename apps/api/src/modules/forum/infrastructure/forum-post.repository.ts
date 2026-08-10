import { Inject, Injectable } from "@nestjs/common";
import { and, asc, desc, eq, getTableColumns, inArray, isNull, lt, sql } from "drizzle-orm";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database } from "../../../database/drizzle";
import { withServiceContext, withUserContext } from "../../../database/rls";
import { forumPostReactions, forumPosts, forumThreads, forumZones, users } from "../../../database/schema";

export type PostRow = typeof forumPosts.$inferSelect;
export type PostWithAuthor = PostRow & {
  authorName: string;
  authorUsername: string | null;
  authorAvatarStorageKey: string | null;
};
/** Author-listing row enriched with its zone (for the profile activity feed's "posted in X" label). */
export type PostWithAuthorAndZone = PostWithAuthor & { zoneTitle: string; zoneSlug: string };

export interface PostReactionUserRow {
  userId: string;
  displayName: string;
  username: string | null;
  avatarStorageKey: string | null;
  emoji: string;
  reactedAt: Date;
}

/**
 * QA answer access (slice 3). Reads run in user context (RLS belt: non-deleted answers to any
 * authed user); writes run in SERVICE context — mirrors ForumThreadRepository.
 */
@Injectable()
export class ForumPostRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /**
   * Per-author activity signals for the community effort board's behaviour badges. Aggregate over a
   * single author's posts + the reactions they've drawn — SERVICE context (read-only). Night = posts
   * authored 00:00–05:00. // ponytail: fine at MVP scale; add an index on forum_posts.author_id if it bites.
   */
  authorActivityStats(
    userId: string,
  ): Promise<{ totalPosts: number; nightPosts: number; reactionsReceived: number }> {
    return withServiceContext(this.db, async (tx) => {
      const [posts] = await tx
        .select({
          total: sql<number>`count(*)::int`,
          night: sql<number>`count(*) filter (where extract(hour from ${forumPosts.createdAt}) < 5)::int`,
        })
        .from(forumPosts)
        .where(and(eq(forumPosts.authorId, userId), isNull(forumPosts.deletedAt)));

      const [react] = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(forumPostReactions)
        .innerJoin(forumPosts, eq(forumPosts.id, forumPostReactions.postId))
        .where(eq(forumPosts.authorId, userId));

      return {
        totalPosts: posts?.total ?? 0,
        nightPosts: posts?.night ?? 0,
        reactionsReceived: react?.n ?? 0,
      };
    });
  }

  async createAnswer(input: {
    threadId: string;
    authorId: string;
    body: string;
    /** Set for a reply to another comment (APP-017); null/undefined = top-level comment/answer. */
    parentPostId?: string | null;
  }): Promise<PostRow> {
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx
        .insert(forumPosts)
        .values({
          threadId: input.threadId,
          authorId: input.authorId,
          body: input.body,
          parentPostId: input.parentPostId ?? null,
        })
        .returning();
      return rows[0]!;
    });
  }

  /** Top-level comments on a thread (no parent) — oldest first. */
  async listTopLevel(threadId: string, viewerId: string): Promise<PostWithAuthor[]> {
    return withUserContext(this.db, { userId: viewerId }, async (tx) => {
      return tx
        .select({
          ...getTableColumns(forumPosts),
          authorName: sql<string>`coalesce(${users.displayName}, '')`,
          authorUsername: sql<string | null>`${users.username}`,
          authorAvatarStorageKey: sql<string | null>`${users.avatarStorageKey}`,
        })
        .from(forumPosts)
        .leftJoin(users, eq(forumPosts.authorId, users.id))
        .where(
          and(
            eq(forumPosts.threadId, threadId),
            isNull(forumPosts.parentPostId),
            isNull(forumPosts.deletedAt),
          ),
        )
        .orderBy(asc(forumPosts.createdAt));
    });
  }

  /** Direct replies to a comment — oldest first. */
  async listReplies(parentPostId: string, viewerId: string): Promise<PostWithAuthor[]> {
    return withUserContext(this.db, { userId: viewerId }, async (tx) => {
      return tx
        .select({
          ...getTableColumns(forumPosts),
          authorName: sql<string>`coalesce(${users.displayName}, '')`,
          authorUsername: sql<string | null>`${users.username}`,
          authorAvatarStorageKey: sql<string | null>`${users.avatarStorageKey}`,
        })
        .from(forumPosts)
        .leftJoin(users, eq(forumPosts.authorId, users.id))
        .where(and(eq(forumPosts.parentPostId, parentPostId), isNull(forumPosts.deletedAt)))
        .orderBy(asc(forumPosts.createdAt));
    });
  }

  // --- Comment likes (forum_post_reactions) + count aggregates (APP-017) ---

  async setPostReaction(postId: string, userId: string, emoji: string): Promise<void> {
    await withServiceContext(this.db, async (tx) => {
      await tx
        .insert(forumPostReactions)
        .values({ postId, userId, emoji })
        .onConflictDoUpdate({
          target: [forumPostReactions.postId, forumPostReactions.userId],
          set: { emoji, createdAt: new Date() },
        });
    });
  }

  async removePostReaction(postId: string, userId: string, emoji: string): Promise<void> {
    await withServiceContext(this.db, async (tx) => {
      await tx
        .delete(forumPostReactions)
        .where(
          and(
            eq(forumPostReactions.postId, postId),
            eq(forumPostReactions.userId, userId),
            eq(forumPostReactions.emoji, emoji),
          ),
        );
    });
  }

  /** Batched reaction counts per post, keyed by emoji (service context — cross-user aggregate). */
  async reactionCountsByPost(postIds: string[]): Promise<Map<string, Record<string, number>>> {
    if (postIds.length === 0) return new Map();
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx
        .select({
          postId: forumPostReactions.postId,
          emoji: forumPostReactions.emoji,
          count: sql<number>`count(*)::int`,
        })
        .from(forumPostReactions)
        .where(inArray(forumPostReactions.postId, postIds))
        .groupBy(forumPostReactions.postId, forumPostReactions.emoji);
      const map = new Map<string, Record<string, number>>();
      for (const r of rows) {
        const entry = map.get(r.postId) ?? {};
        entry[r.emoji] = r.count;
        map.set(r.postId, entry);
      }
      return map;
    });
  }

  async listReactionUsers(
    postId: string,
    opts: { page: number; pageSize: number; emoji?: string },
  ): Promise<PostReactionUserRow[]> {
    return withServiceContext(this.db, (tx) =>
      tx
        .select({
          userId: users.id,
          displayName: sql<string>`coalesce(${users.displayName}, ${users.username}, '')`,
          username: users.username,
          avatarStorageKey: users.avatarStorageKey,
          emoji: forumPostReactions.emoji,
          reactedAt: forumPostReactions.createdAt,
        })
        .from(forumPostReactions)
        .innerJoin(users, eq(users.id, forumPostReactions.userId))
        .where(
          and(
            eq(forumPostReactions.postId, postId),
            opts.emoji ? eq(forumPostReactions.emoji, opts.emoji) : undefined,
          ),
        )
        .orderBy(desc(forumPostReactions.createdAt))
        .limit(opts.pageSize)
        .offset((opts.page - 1) * opts.pageSize),
    );
  }

  async countReactionUsers(postId: string, emoji?: string): Promise<number> {
    return withServiceContext(this.db, async (tx) => {
      const [row] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(forumPostReactions)
        .where(
          and(
            eq(forumPostReactions.postId, postId),
            emoji ? eq(forumPostReactions.emoji, emoji) : undefined,
          ),
        );
      return row?.count ?? 0;
    });
  }

  /** Batched viewer reaction state. Arrays are retained for API compatibility but contain 0..1 item. */
  async myReactionsByPost(postIds: string[], userId: string): Promise<Map<string, string[]>> {
    if (postIds.length === 0) return new Map();
    return withUserContext(this.db, { userId }, async (tx) => {
      const rows = await tx
        .select({ postId: forumPostReactions.postId, emoji: forumPostReactions.emoji })
        .from(forumPostReactions)
        .where(and(inArray(forumPostReactions.postId, postIds), eq(forumPostReactions.userId, userId)));
      const map = new Map<string, string[]>();
      for (const r of rows) {
        const arr = map.get(r.postId) ?? [];
        arr.push(r.emoji);
        map.set(r.postId, arr);
      }
      return map;
    });
  }

  /** Batched: non-deleted direct-reply count per post. */
  async replyCountsByPost(postIds: string[]): Promise<Map<string, number>> {
    if (postIds.length === 0) return new Map();
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx
        .select({ parentPostId: forumPosts.parentPostId, count: sql<number>`count(*)::int` })
        .from(forumPosts)
        .where(and(inArray(forumPosts.parentPostId, postIds), isNull(forumPosts.deletedAt)))
        .groupBy(forumPosts.parentPostId);
      const map = new Map<string, number>();
      for (const r of rows) if (r.parentPostId) map.set(r.parentPostId, r.count);
      return map;
    });
  }

  /** Answers for a question — accepted first, then oldest-first. */
  async listByThread(threadId: string, viewerId: string): Promise<PostWithAuthor[]> {
    return withUserContext(this.db, { userId: viewerId }, async (tx) => {
      return tx
        .select({
          ...getTableColumns(forumPosts),
          authorName: sql<string>`coalesce(${users.displayName}, '')`,
          authorUsername: sql<string | null>`${users.username}`,
          authorAvatarStorageKey: sql<string | null>`${users.avatarStorageKey}`,
        })
        .from(forumPosts)
        .leftJoin(users, eq(forumPosts.authorId, users.id))
        .where(and(eq(forumPosts.threadId, threadId), isNull(forumPosts.deletedAt)))
        .orderBy(desc(forumPosts.isAccepted), asc(forumPosts.createdAt));
    });
  }

  /** Public (SEO) answers for a question — service-context, non-deleted, accepted-first. */
  async listPublicAnswers(threadId: string): Promise<PostRow[]> {
    return withServiceContext(this.db, async (tx) => {
      return tx
        .select()
        .from(forumPosts)
        .where(and(eq(forumPosts.threadId, threadId), isNull(forumPosts.deletedAt)))
        .orderBy(desc(forumPosts.isAccepted), asc(forumPosts.createdAt));
    });
  }

  async findById(postId: string, viewerId: string): Promise<PostWithAuthor | null> {
    return withUserContext(this.db, { userId: viewerId }, async (tx) => {
      const [row] = await tx
        .select({
          ...getTableColumns(forumPosts),
          authorName: sql<string>`coalesce(${users.displayName}, '')`,
          authorUsername: sql<string | null>`${users.username}`,
          authorAvatarStorageKey: sql<string | null>`${users.avatarStorageKey}`,
        })
        .from(forumPosts)
        .leftJoin(users, eq(forumPosts.authorId, users.id))
        .where(eq(forumPosts.id, postId))
        .limit(1);
      return row ?? null;
    });
  }

  /** A user's own posts (comments + QA answers), newest first (for their profile). */
  async listByAuthor(
    authorId: string,
    viewerId: string,
    opts: { limit: number; before?: string },
  ): Promise<PostWithAuthorAndZone[]> {
    return withUserContext(this.db, { userId: viewerId }, async (tx) => {
      const conds = [eq(forumPosts.authorId, authorId), isNull(forumPosts.deletedAt)];
      if (opts.before) conds.push(lt(forumPosts.createdAt, new Date(opts.before)));
      return tx
        .select({
          ...getTableColumns(forumPosts),
          authorName: sql<string>`coalesce(${users.displayName}, '')`,
          authorUsername: sql<string | null>`${users.username}`,
          authorAvatarStorageKey: sql<string | null>`${users.avatarStorageKey}`,
          zoneTitle: sql<string>`coalesce(${forumZones.title}, '')`,
          zoneSlug: sql<string>`coalesce(${forumZones.slug}, '')`,
        })
        .from(forumPosts)
        .leftJoin(users, eq(forumPosts.authorId, users.id))
        .leftJoin(forumThreads, eq(forumPosts.threadId, forumThreads.id))
        .leftJoin(forumZones, eq(forumThreads.zoneId, forumZones.id))
        .where(and(...conds))
        .orderBy(desc(forumPosts.createdAt))
        .limit(opts.limit);
    });
  }

  /** Visible posts for a set of ids (RLS hides deleted for the viewer). Order not guaranteed. */
  async findManyByIds(postIds: string[], viewerId: string): Promise<PostWithAuthor[]> {
    if (postIds.length === 0) return [];
    return withUserContext(this.db, { userId: viewerId }, async (tx) =>
      tx
        .select({
          ...getTableColumns(forumPosts),
          authorName: sql<string>`coalesce(${users.displayName}, '')`,
          authorUsername: sql<string | null>`${users.username}`,
          authorAvatarStorageKey: sql<string | null>`${users.avatarStorageKey}`,
        })
        .from(forumPosts)
        .leftJoin(users, eq(forumPosts.authorId, users.id))
        .where(and(inArray(forumPosts.id, postIds), isNull(forumPosts.deletedAt))),
    );
  }

  async setAccepted(postId: string, accepted: boolean): Promise<void> {
    await withServiceContext(this.db, async (tx) => {
      await tx
        .update(forumPosts)
        .set({ isAccepted: accepted, updatedAt: new Date() })
        .where(eq(forumPosts.id, postId));
    });
  }

  async softDelete(postId: string, byUserId: string): Promise<void> {
    await withServiceContext(this.db, async (tx) => {
      await tx
        .update(forumPosts)
        .set({ deletedAt: new Date(), deletedBy: byUserId, updatedAt: new Date() })
        .where(eq(forumPosts.id, postId));
    });
  }

  /** Reverse a hide (moderation RESTORE). */
  async restore(postId: string): Promise<void> {
    await withServiceContext(this.db, async (tx) => {
      await tx
        .update(forumPosts)
        .set({ deletedAt: null, deletedBy: null, updatedAt: new Date() })
        .where(eq(forumPosts.id, postId));
    });
  }

  /** Service-context fetch incl. soft-deleted rows (for restore — RLS user-read hides them). */
  async findByIdIncludingDeleted(postId: string): Promise<PostRow | null> {
    return withServiceContext(this.db, async (tx) => {
      const [row] = await tx.select().from(forumPosts).where(eq(forumPosts.id, postId)).limit(1);
      return row ?? null;
    });
  }
}
