import { Injectable } from "@nestjs/common";
import { and, desc, eq, sql } from "drizzle-orm";
import type { DatabaseTx } from "../../../database/drizzle";
import { moodCheckins } from "../../../database/schema";

export type MoodCheckinRow = typeof moodCheckins.$inferSelect;

/** Data access for `mood_checkins` (one per day; upsert on the (user_id, checkin_date) index). */
@Injectable()
export class MoodCheckinRepository {
  /**
   * Upsert today's mood (replaces value/note if the user re-checks the same day). The cached AI
   * reflection is invalidated ONLY when the mood or note actually changes — re-submitting the same
   * value (or a panel reload) keeps the existing reflection, so it never triggers a fresh LLM call
   * (cost control, §7). `IS DISTINCT FROM` is NULL-safe for the optional note.
   */
  async upsert(
    tx: DatabaseTx,
    userId: string,
    date: string,
    mood: number,
    struggleNote: string | null,
  ): Promise<MoodCheckinRow> {
    const unchanged = sql`${moodCheckins.mood} = ${mood} AND ${moodCheckins.struggleNote} IS NOT DISTINCT FROM ${struggleNote}`;
    const rows = await tx
      .insert(moodCheckins)
      .values({ userId, checkinDate: date, mood, struggleNote })
      .onConflictDoUpdate({
        target: [moodCheckins.userId, moodCheckins.checkinDate],
        set: {
          mood,
          struggleNote,
          aiReflection: sql`CASE WHEN ${unchanged} THEN ${moodCheckins.aiReflection} ELSE NULL END`,
          aiModel: sql`CASE WHEN ${unchanged} THEN ${moodCheckins.aiModel} ELSE NULL END`,
          aiReflectedAt: sql`CASE WHEN ${unchanged} THEN ${moodCheckins.aiReflectedAt} ELSE NULL END`,
        },
      })
      .returning();
    return rows[0]!;
  }

  /** Cache today's premium AI-adaptive reflection in place (idempotent per day; tx owns RLS). */
  async setAiReflection(
    tx: DatabaseTx,
    userId: string,
    date: string,
    reflection: string,
    model: string,
  ): Promise<void> {
    await tx
      .update(moodCheckins)
      .set({ aiReflection: reflection, aiModel: model, aiReflectedAt: new Date() })
      .where(and(eq(moodCheckins.userId, userId), eq(moodCheckins.checkinDate, date)));
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
