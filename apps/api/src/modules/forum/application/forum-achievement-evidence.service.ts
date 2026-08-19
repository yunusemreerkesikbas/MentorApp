import { Inject, Injectable } from "@nestjs/common";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import type { AchievementId } from "@mentor/types";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database } from "../../../database/drizzle";
import { withServiceContext } from "../../../database/rls";
import { forumHelpfulVotes, forumPosts, forumThreads } from "../../../database/schema";

export interface ForumAchievementEvidence {
  userId: string;
  achievementId: AchievementId;
  earnedAt: Date;
}

@Injectable()
export class ForumAchievementEvidenceService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async collect(userIds: string[]): Promise<ForumAchievementEvidence[]> {
    if (userIds.length === 0) return [];
    return withServiceContext(this.db, async (tx) => {
      const [threads, posts, helpfulThreads, helpfulPosts, acceptedPosts] = await Promise.all([
        tx.select({ userId: forumThreads.authorId, earnedAt: sql<Date>`min(${forumThreads.createdAt})` })
          .from(forumThreads)
          .where(and(inArray(forumThreads.authorId, userIds), isNull(forumThreads.deletedAt)))
          .groupBy(forumThreads.authorId),
        tx.select({ userId: forumPosts.authorId, earnedAt: sql<Date>`min(${forumPosts.createdAt})` })
          .from(forumPosts)
          .where(and(inArray(forumPosts.authorId, userIds), isNull(forumPosts.deletedAt)))
          .groupBy(forumPosts.authorId),
        tx.select({ userId: forumThreads.authorId, earnedAt: sql<Date>`min(${forumHelpfulVotes.createdAt})` })
          .from(forumHelpfulVotes)
          .innerJoin(forumThreads, eq(forumHelpfulVotes.targetId, forumThreads.id))
          .where(and(eq(forumHelpfulVotes.targetType, "THREAD"), inArray(forumThreads.authorId, userIds), isNull(forumThreads.deletedAt)))
          .groupBy(forumThreads.authorId),
        tx.select({ userId: forumPosts.authorId, earnedAt: sql<Date>`min(${forumHelpfulVotes.createdAt})` })
          .from(forumHelpfulVotes)
          .innerJoin(forumPosts, eq(forumHelpfulVotes.targetId, forumPosts.id))
          .where(and(eq(forumHelpfulVotes.targetType, "POST"), inArray(forumPosts.authorId, userIds), isNull(forumPosts.deletedAt)))
          .groupBy(forumPosts.authorId),
        tx.select({ userId: forumPosts.authorId, earnedAt: sql<Date>`min(${forumPosts.createdAt})` })
          .from(forumPosts)
          .where(and(inArray(forumPosts.authorId, userIds), eq(forumPosts.isAccepted, true), isNull(forumPosts.deletedAt)))
          .groupBy(forumPosts.authorId),
      ]);

      const earliestContribution = new Map<string, Date>();
      for (const row of [...threads, ...posts]) {
        const date = new Date(row.earnedAt);
        const current = earliestContribution.get(row.userId);
        if (!current || date < current) earliestContribution.set(row.userId, date);
      }
      const earliestHelpful = new Map<string, Date>();
      for (const row of [...helpfulThreads, ...helpfulPosts, ...acceptedPosts]) {
        const date = new Date(row.earnedAt);
        const current = earliestHelpful.get(row.userId);
        if (!current || date < current) earliestHelpful.set(row.userId, date);
      }
      return [
        ...[...earliestContribution].map(([userId, earnedAt]) => ({ userId, achievementId: "first_hello" as const, earnedAt })),
        ...[...earliestHelpful].map(([userId, earnedAt]) => ({ userId, achievementId: "helped_someone" as const, earnedAt })),
      ];
    });
  }
}
