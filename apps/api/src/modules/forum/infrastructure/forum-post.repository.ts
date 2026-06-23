import { Inject, Injectable } from "@nestjs/common";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database } from "../../../database/drizzle";
import { withServiceContext, withUserContext } from "../../../database/rls";
import { forumPosts } from "../../../database/schema";

export type PostRow = typeof forumPosts.$inferSelect;

/**
 * QA answer access (slice 3). Reads run in user context (RLS belt: non-deleted answers to any
 * authed user); writes run in SERVICE context — mirrors ForumThreadRepository.
 */
@Injectable()
export class ForumPostRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async createAnswer(input: { threadId: string; authorId: string; body: string }): Promise<PostRow> {
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx
        .insert(forumPosts)
        .values({ threadId: input.threadId, authorId: input.authorId, body: input.body })
        .returning();
      return rows[0]!;
    });
  }

  /** Answers for a question — accepted first, then oldest-first. */
  async listByThread(threadId: string, viewerId: string): Promise<PostRow[]> {
    return withUserContext(this.db, { userId: viewerId }, async (tx) => {
      return tx
        .select()
        .from(forumPosts)
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

  async findById(postId: string, viewerId: string): Promise<PostRow | null> {
    return withUserContext(this.db, { userId: viewerId }, async (tx) => {
      const [row] = await tx.select().from(forumPosts).where(eq(forumPosts.id, postId)).limit(1);
      return row ?? null;
    });
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
