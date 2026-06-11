import { Injectable } from "@nestjs/common";
import { and, eq, gte, isNotNull, lt, sql } from "drizzle-orm";
import type { DatabaseTx } from "../../../database/drizzle";
import { studySessions } from "../../../database/schema";
import { StudySessionStatus } from "../domain/coaching.constants";
import { addDays } from "../domain/date.util";

export type StudySessionRow = typeof studySessions.$inferSelect;
export type NewStudySession = typeof studySessions.$inferInsert;

/** Data access for `study_sessions` (RLS-scoped `tx` from the service). */
@Injectable()
export class StudySessionRepository {
  async create(tx: DatabaseTx, data: NewStudySession): Promise<StudySessionRow> {
    const rows = await tx
      .insert(studySessions)
      .values({ ...data, status: StudySessionStatus.IN_PROGRESS })
      .returning();
    return rows[0]!;
  }

  async findById(tx: DatabaseTx, userId: string, id: string): Promise<StudySessionRow | undefined> {
    const rows = await tx
      .select()
      .from(studySessions)
      .where(and(eq(studySessions.id, id), eq(studySessions.userId, userId)))
      .limit(1);
    return rows[0];
  }

  async update(
    tx: DatabaseTx,
    userId: string,
    id: string,
    patch: Partial<NewStudySession>,
  ): Promise<StudySessionRow | undefined> {
    const rows = await tx
      .update(studySessions)
      .set(patch)
      .where(and(eq(studySessions.id, id), eq(studySessions.userId, userId)))
      .returning();
    return rows[0];
  }

  /**
   * Whether the user has any FINALIZED completed session on the given UTC calendar date.
   * "Finalized" = status COMPLETED and `ended_at` set, so an in-progress (just-started) row
   * does not count until it is actually completed.
   */
  async hasCompletedOnDate(tx: DatabaseTx, userId: string, date: string): Promise<boolean> {
    const dayStart = `${date}T00:00:00Z`;
    const nextDayStart = `${addDays(date, 1)}T00:00:00Z`;
    const rows = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(studySessions)
      .where(
        and(
          eq(studySessions.userId, userId),
          eq(studySessions.status, "COMPLETED"),
          isNotNull(studySessions.endedAt),
          gte(studySessions.startedAt, new Date(dayStart)),
          lt(studySessions.startedAt, new Date(nextDayStart)),
        ),
      );
    return (rows[0]?.count ?? 0) > 0;
  }
}
