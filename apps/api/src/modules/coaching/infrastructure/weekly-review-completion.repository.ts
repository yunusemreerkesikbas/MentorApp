import { Inject, Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database } from "../../../database/drizzle";
import { withUserContext } from "../../../database/rls";
import { weeklyReviewCompletions } from "../../../database/schema";

export type WeeklyReviewCompletionRow = typeof weeklyReviewCompletions.$inferSelect;

@Injectable()
export class WeeklyReviewCompletionRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  upsert(
    userId: string,
    examId: string,
    weekStart: string,
  ): Promise<{ row: WeeklyReviewCompletionRow; inserted: boolean }> {
    return withUserContext(this.db, { userId }, async (tx) => {
      const inserted = await tx
        .insert(weeklyReviewCompletions)
        .values({ userId, examId, weekStart })
        .onConflictDoNothing({
          target: [
            weeklyReviewCompletions.userId,
            weeklyReviewCompletions.examId,
            weeklyReviewCompletions.weekStart,
          ],
        })
        .returning();
      if (inserted[0]) return { row: inserted[0], inserted: true };
      const rows = await tx
        .select()
        .from(weeklyReviewCompletions)
        .where(
          and(
            eq(weeklyReviewCompletions.userId, userId),
            eq(weeklyReviewCompletions.examId, examId),
            eq(weeklyReviewCompletions.weekStart, weekStart),
          ),
        )
        .limit(1);
      return { row: rows[0]!, inserted: false };
    });
  }
}
