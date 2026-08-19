import { Inject, Injectable } from "@nestjs/common";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import type { AchievementId, AchievementSource } from "@mentor/types";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database } from "../../../database/drizzle";
import { withServiceContext, withUserContext } from "../../../database/rls";
import { userAchievements } from "../../../database/schema";

export type AchievementRow = typeof userAchievements.$inferSelect;

@Injectable()
export class AchievementRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  listByUser(viewerId: string, userId: string): Promise<AchievementRow[]> {
    return withUserContext(this.db, { userId: viewerId }, (tx) =>
      tx
        .select()
        .from(userAchievements)
        .where(eq(userAchievements.userId, userId))
        .orderBy(asc(userAchievements.earnedAt)),
    );
  }

  listUnseen(userId: string): Promise<AchievementRow[]> {
    return withUserContext(this.db, { userId }, (tx) =>
      tx
        .select()
        .from(userAchievements)
        .where(
          and(
            eq(userAchievements.userId, userId),
            isNull(userAchievements.celebratedAt),
          ),
        )
        .orderBy(asc(userAchievements.earnedAt)),
    );
  }

  award(input: {
    userId: string;
    orgId: string | null;
    achievementId: AchievementId;
    ruleVersion: number;
    source: AchievementSource;
    earnedAt: Date;
  }): Promise<AchievementRow | null> {
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx
        .insert(userAchievements)
        .values(input)
        .onConflictDoNothing({
          target: [userAchievements.userId, userAchievements.achievementId],
        })
        .returning();
      return rows[0] ?? null;
    });
  }

  awardMany(inputs: Array<{
    userId: string;
    orgId: string | null;
    achievementId: AchievementId;
    ruleVersion: number;
    source: AchievementSource;
    earnedAt: Date;
  }>): Promise<AchievementRow[]> {
    if (inputs.length === 0) return Promise.resolve([]);
    return withServiceContext(this.db, (tx) => tx
      .insert(userAchievements)
      .values(inputs)
      .onConflictDoNothing({ target: [userAchievements.userId, userAchievements.achievementId] })
      .returning());
  }

  async markCelebrated(userId: string, achievementIds: AchievementId[]): Promise<void> {
    if (achievementIds.length === 0) return;
    await withUserContext(this.db, { userId }, (tx) =>
      tx
        .update(userAchievements)
        .set({ celebratedAt: new Date() })
        .where(
          and(
            eq(userAchievements.userId, userId),
            inArray(userAchievements.achievementId, achievementIds),
            isNull(userAchievements.celebratedAt),
          ),
        ),
    );
  }
}
