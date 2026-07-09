import { Injectable } from "@nestjs/common";
import { and, desc, eq, gte, isNotNull, lt, sql } from "drizzle-orm";
import type { DatabaseTx } from "../../../database/drizzle";
import { studySessions } from "../../../database/schema";
import { StudySessionStatus } from "../domain/coaching.constants";
import { addDays } from "../domain/date.util";

export type StudySessionRow = typeof studySessions.$inferSelect;
export type NewStudySession = typeof studySessions.$inferInsert;

/**
 * How many recent finalized rows the summary scans to derive distinct subjects + the last note.
 * Bounded and > {@link RECENT_SUBJECTS_MAX} so repeated subjects still yield enough distinct ones.
 */
const RECENT_SUMMARY_SCAN_ROWS = 20;

/** Raw shape for {@link StudySessionRepository.recentSummary} (service maps it to the domain summary). */
export interface RecentSummaryRow {
  count7d: number;
  focusSeconds7d: number;
  recentRows: { subject: string | null; struggleNote: string | null }[];
}

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

  /** Paginated finalized-session history (most recent first). */
  async listPaged(
    tx: DatabaseTx,
    userId: string,
    page: number,
    pageSize: number,
  ): Promise<{ items: StudySessionRow[]; total: number }> {
    const where = and(eq(studySessions.userId, userId), isNotNull(studySessions.endedAt));
    const [items, totalRow] = await Promise.all([
      tx
        .select()
        .from(studySessions)
        .where(where)
        .orderBy(desc(studySessions.startedAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      tx.select({ count: sql<number>`count(*)::int` }).from(studySessions).where(where),
    ]);
    return { items, total: totalRow[0]?.count ?? 0 };
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

  /**
   * Aggregate of recent finalized sessions for the AI coach context: count + focused seconds
   * since `since`, plus the most-recent finalized rows (subject/note) to derive distinct subjects
   * and the last struggle note. Two bounded queries; the service shapes the PII-free summary.
   */
  async recentSummary(tx: DatabaseTx, userId: string, since: Date): Promise<RecentSummaryRow> {
    const finalized = and(eq(studySessions.userId, userId), isNotNull(studySessions.endedAt));
    const [aggRows, recentRows] = await Promise.all([
      tx
        .select({
          count: sql<number>`count(*)::int`,
          focusSeconds: sql<number>`coalesce(sum(${studySessions.actualFocusSeconds}), 0)::int`,
        })
        .from(studySessions)
        .where(and(finalized, gte(studySessions.startedAt, since))),
      tx
        .select({ subject: studySessions.subject, struggleNote: studySessions.struggleNote })
        .from(studySessions)
        .where(finalized)
        .orderBy(desc(studySessions.startedAt))
        .limit(RECENT_SUMMARY_SCAN_ROWS),
    ]);
    return {
      count7d: aggRows[0]?.count ?? 0,
      focusSeconds7d: aggRows[0]?.focusSeconds ?? 0,
      recentRows,
    };
  }

  async countCompleted(tx: DatabaseTx, userId: string): Promise<number> {
    const rows = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(studySessions)
      .where(
        and(
          eq(studySessions.userId, userId),
          eq(studySessions.status, StudySessionStatus.COMPLETED),
          isNotNull(studySessions.endedAt),
        ),
      );
    return rows[0]?.count ?? 0;
  }
}
