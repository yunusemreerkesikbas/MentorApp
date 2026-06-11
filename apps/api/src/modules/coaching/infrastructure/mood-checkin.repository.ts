import { Injectable } from "@nestjs/common";
import { and, desc, eq, sql } from "drizzle-orm";
import type { DatabaseTx } from "../../../database/drizzle";
import { moodCheckins } from "../../../database/schema";

export type MoodCheckinRow = typeof moodCheckins.$inferSelect;

/** Data access for `mood_checkins` (one per day; upsert on the (user_id, checkin_date) index). */
@Injectable()
export class MoodCheckinRepository {
  /** Upsert today's mood (replaces the value if the user re-checks in the same day). */
  async upsert(
    tx: DatabaseTx,
    userId: string,
    date: string,
    mood: number,
  ): Promise<MoodCheckinRow> {
    const rows = await tx
      .insert(moodCheckins)
      .values({ userId, checkinDate: date, mood })
      .onConflictDoUpdate({
        target: [moodCheckins.userId, moodCheckins.checkinDate],
        set: { mood },
      })
      .returning();
    return rows[0]!;
  }

  async findByDate(
    tx: DatabaseTx,
    userId: string,
    date: string,
  ): Promise<MoodCheckinRow | undefined> {
    const rows = await tx
      .select()
      .from(moodCheckins)
      .where(and(eq(moodCheckins.userId, userId), eq(moodCheckins.checkinDate, date)))
      .limit(1);
    return rows[0];
  }

  /** Paginated mood trend (most recent first). */
  async listPaged(
    tx: DatabaseTx,
    userId: string,
    page: number,
    pageSize: number,
  ): Promise<{ items: MoodCheckinRow[]; total: number }> {
    const where = eq(moodCheckins.userId, userId);
    const [items, totalRow] = await Promise.all([
      tx
        .select()
        .from(moodCheckins)
        .where(where)
        .orderBy(desc(moodCheckins.checkinDate))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      tx.select({ count: sql<number>`count(*)::int` }).from(moodCheckins).where(where),
    ]);
    return { items, total: totalRow[0]?.count ?? 0 };
  }
}
