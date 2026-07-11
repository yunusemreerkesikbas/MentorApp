import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, lt, sql } from "drizzle-orm";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database } from "../../../database/drizzle";
import { withServiceContext } from "../../../database/rls";
import { userFollows, users } from "../../../database/schema";

/** A row of a follower/following list: the listed user + whether the viewer follows them. */
export interface FollowRow {
  userId: string;
  displayName: string;
  username: string | null;
  avatarStorageKey: string | null;
  /** The viewer's relationship to this listed user (for a follow-back button). */
  viewerFollows: boolean;
  /** The follow edge's createdAt — drives the cursor. */
  createdAt: Date;
}

/**
 * Social follow graph (`user_follows`). One-way, public, idempotent. Runs in SERVICE context and is
 * own-user scoped by the WHERE clause (the follower id is always the authenticated user — no forging),
 * mirroring ForumBookmarkRepository's trust model. BANNED/SUSPENDED users are excluded from lists.
 */
@Injectable()
export class FollowRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /** Follow (idempotent — a repeated follow is a no-op). */
  async follow(followerId: string, followeeId: string): Promise<void> {
    await withServiceContext(this.db, (tx) =>
      tx.insert(userFollows).values({ followerId, followeeId }).onConflictDoNothing(),
    );
  }

  /** Unfollow (no-op if not following). */
  async unfollow(followerId: string, followeeId: string): Promise<void> {
    await withServiceContext(this.db, (tx) =>
      tx
        .delete(userFollows)
        .where(and(eq(userFollows.followerId, followerId), eq(userFollows.followeeId, followeeId))),
    );
  }

  async isFollowing(followerId: string, followeeId: string): Promise<boolean> {
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx
        .select({ id: userFollows.id })
        .from(userFollows)
        .where(and(eq(userFollows.followerId, followerId), eq(userFollows.followeeId, followeeId)))
        .limit(1);
      return rows.length > 0;
    });
  }

  async countFollowers(userId: string): Promise<number> {
    return this.count(eq(userFollows.followeeId, userId));
  }

  async countFollowing(userId: string): Promise<number> {
    return this.count(eq(userFollows.followerId, userId));
  }

  private async count(where: ReturnType<typeof eq>): Promise<number> {
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(userFollows)
        .where(where);
      return rows[0]?.n ?? 0;
    });
  }

  /** The ids a user follows — drives the cross-zone "Akış" feed's author set. */
  async getFolloweeIds(followerId: string): Promise<string[]> {
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx
        .select({ followeeId: userFollows.followeeId })
        .from(userFollows)
        .where(eq(userFollows.followerId, followerId));
      return rows.map((r) => r.followeeId);
    });
  }

  /** Users who follow `userId`, newest-follow first, cursor-paginated on the follow's createdAt. */
  async listFollowers(
    userId: string,
    viewerId: string,
    opts: { limit: number; before?: Date },
  ): Promise<FollowRow[]> {
    return this.listEdges({ subjectCol: "followee", listedCol: "follower", userId, viewerId, opts });
  }

  /** Users `userId` follows, newest-follow first, cursor-paginated on the follow's createdAt. */
  async listFollowing(
    userId: string,
    viewerId: string,
    opts: { limit: number; before?: Date },
  ): Promise<FollowRow[]> {
    return this.listEdges({ subjectCol: "follower", listedCol: "followee", userId, viewerId, opts });
  }

  /**
   * Shared edge lister. `subjectCol` fixes which side equals `userId` (the profile owner); `listedCol`
   * is the other side — the users returned. A LEFT JOIN to the viewer's own follow edges computes
   * `viewerFollows` in one query (no N+1). Excludes BANNED/SUSPENDED listed users.
   */
  private async listEdges(args: {
    subjectCol: "follower" | "followee";
    listedCol: "follower" | "followee";
    userId: string;
    viewerId: string;
    opts: { limit: number; before?: Date };
  }): Promise<FollowRow[]> {
    const { subjectCol, listedCol, userId, viewerId, opts } = args;
    const subject = subjectCol === "follower" ? userFollows.followerId : userFollows.followeeId;
    const listed = listedCol === "follower" ? userFollows.followerId : userFollows.followeeId;
    return withServiceContext(this.db, async (tx) => {
      const conds = [eq(subject, userId), sql`${users.status} not in ('BANNED', 'SUSPENDED')`];
      if (opts.before) conds.push(lt(userFollows.createdAt, opts.before));
      return tx
        .select({
          userId: users.id,
          displayName: sql<string>`coalesce(${users.displayName}, '')`,
          username: users.username,
          avatarStorageKey: users.avatarStorageKey,
          viewerFollows: sql<boolean>`exists (
            select 1 from ${userFollows} vf
            where vf.follower_id = ${viewerId} and vf.followee_id = ${listed}
          )`,
          createdAt: userFollows.createdAt,
        })
        .from(userFollows)
        .innerJoin(users, eq(users.id, listed))
        .where(and(...conds))
        .orderBy(desc(userFollows.createdAt))
        .limit(opts.limit);
    });
  }
}
