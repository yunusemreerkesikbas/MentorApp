import { Inject, Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database, DatabaseTx } from "../../../database/drizzle";
import { withServiceContext, withUserContext } from "../../../database/rls";
import { aiWeeklyReviews } from "../../../database/schema";

@Injectable()
export class WeeklyReviewCacheRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  findAny(userId: string, examId: string, weekStart: string, exec?: DatabaseTx) {
    const read = async (tx: DatabaseTx) => (await tx.select().from(aiWeeklyReviews)
      .where(and(eq(aiWeeklyReviews.userId, userId), eq(aiWeeklyReviews.examId, examId),
        eq(aiWeeklyReviews.weekStart, weekStart))).orderBy(aiWeeklyReviews.createdAt, aiWeeklyReviews.id).limit(1))[0];
    return exec ? read(exec) : withUserContext(this.db, { userId }, read);
  }

  async saveFirst(data: typeof aiWeeklyReviews.$inferInsert, tx: DatabaseTx) {
    await tx.insert(aiWeeklyReviews).values(data).onConflictDoNothing();
  }

  async find(userId: string, examId: string, weekStart: string, locale: string) {
    return withUserContext(this.db, { userId }, async (tx) => {
      const rows = await tx
        .select()
        .from(aiWeeklyReviews)
        .where(and(
          eq(aiWeeklyReviews.userId, userId),
          eq(aiWeeklyReviews.examId, examId),
          eq(aiWeeklyReviews.weekStart, weekStart),
          eq(aiWeeklyReviews.locale, locale),
        ))
        .limit(1);
      return rows[0];
    });
  }

  /** KVKK erasure: drop all cached narrations (AI-generated text about the user). Idempotent. */
  async deleteAllForUser(userId: string): Promise<void> {
    await withServiceContext(this.db, async (tx) => {
      await tx.delete(aiWeeklyReviews).where(eq(aiWeeklyReviews.userId, userId));
    });
  }

  async upsert(data: {
    userId: string;
    examId: string;
    weekStart: string;
    locale: string;
    sourceFingerprint: string;
    narration: string;
    model: string;
  }): Promise<void> {
    await withUserContext(this.db, { userId: data.userId }, async (tx) => {
      await tx
        .insert(aiWeeklyReviews)
        .values(data)
        .onConflictDoUpdate({
          target: [
            aiWeeklyReviews.userId,
            aiWeeklyReviews.examId,
            aiWeeklyReviews.weekStart,
            aiWeeklyReviews.locale,
          ],
          set: {
            sourceFingerprint: data.sourceFingerprint,
            narration: data.narration,
            model: data.model,
            updatedAt: new Date(),
          },
        });
    });
  }
}

