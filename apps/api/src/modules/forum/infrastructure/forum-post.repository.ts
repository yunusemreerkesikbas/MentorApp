import { Inject, Injectable } from "@nestjs/common";
import { and, asc, desc, eq, getTableColumns, inArray, isNull, sql } from "drizzle-orm";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database } from "../../../database/drizzle";
import { withServiceContext, withUserContext } from "../../../database/rls";
import { forumPostReactions, forumPosts, users } from "../../../database/schema";

export type PostRow = typeof forumPosts.$inferSelect;
export type PostWithAuthor = PostRow & {
  authorName: string;
  authorUsername: string | null;
  authorAvatarStorageKey: string | null;
};

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

  async addPostReaction(postId: string, userId: string, emoji: string): Promise<void> {
    await withServiceContext(this.db, async (tx) => {
      await tx.insert(forumPostReactions).values({ postId, userId, emoji }).onConflictDoNothing();
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

  /** Batched like count per post (service context — cross-user aggregate). */
  async likeCountsByPost(postIds: string[]): Promise<Map<string, number>> {
    if (postIds.length === 0) return new Map();
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx
        .select({ postId: forumPostReactions.postId, count: sql<number>`count(*)::int` })
        .from(forumPostReactions)
        .where(inArray(forumPostReactions.postId, postIds))
        .groupBy(forumPostReactions.postId);
      const map = new Map<string, number>();
      for (const r of rows) map.set(r.postId, r.count);
      return map;
    });
  }

  /** Batched: which posts the viewer has liked (their own rows, RLS user context). */
  async myLikedPosts(postIds: string[], userId: string): Promise<Set<string>> {
    if (postIds.length === 0) return new Set();
    return withUserContext(this.db, { userId }, async (tx) => {
      const rows = await tx
        .select({ postId: forumPostReactions.postId })
        .from(forumPostReactions)
        .where(and(inArray(forumPostReactions.postId, postIds), eq(forumPostReactions.userId, userId)));
      return new Set(rows.map((r) => r.postId));
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
