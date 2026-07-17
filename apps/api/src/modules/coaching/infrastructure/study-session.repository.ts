import { Injectable } from "@nestjs/common";
import { and, desc, eq, getTableColumns, gte, isNotNull, isNull, lt, sql } from "drizzle-orm";
import type { DatabaseTx } from "../../../database/drizzle";
import { planTasks, studySessions } from "../../../database/schema";
import { StudySessionStatus } from "../domain/coaching.constants";
import { addDays, parseIsoDate } from "../domain/date.util";

export type StudySessionRow = typeof studySessions.$inferSelect;
export type StudySessionListRow = StudySessionRow & { planTaskTitle: string | null };
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

  /**
   * Lazily close the user's orphaned IN_PROGRESS sessions (tab died before
   * finalize): anything past planned length + grace becomes ABANDONED with
   * zero focus credit — the client resume flow is the honest crediting path.
   */
  async closeStaleOpenSessions(
    tx: DatabaseTx,
    userId: string,
    graceMinutes: number,
  ): Promise<void> {
    await tx
      .update(studySessions)
      .set({ status: StudySessionStatus.ABANDONED, endedAt: new Date() })
      .where(
        and(
          eq(studySessions.userId, userId),
          eq(studySessions.status, StudySessionStatus.IN_PROGRESS),
          isNull(studySessions.endedAt),
          sql`${studySessions.startedAt} < now() - (coalesce(${studySessions.plannedFocusMinutes}, case ${studySessions.preset} when '50_10' then 50 else 25 end) + ${graceMinutes}) * interval '1 minute'`,
        ),
      );
  }

  /** Paginated finalized-session history (most recent first). */
  async listPaged(
    tx: DatabaseTx,
    userId: string,
    page: number,
    pageSize: number,
    subject?: string,
    from?: string,
    to?: string,
  ): Promise<{ items: StudySessionListRow[]; total: number }> {
    const where = and(
      eq(studySessions.userId, userId),
      isNotNull(studySessions.endedAt),
      subject ? eq(studySessions.subject, subject) : undefined,
      from ? gte(studySessions.startedAt, parseIsoDate(from)) : undefined,
      to ? lt(studySessions.startedAt, parseIsoDate(addDays(to, 1))) : undefined,
    );
    const [items, totalRow] = await Promise.all([
      tx
        .select({
          ...getTableColumns(studySessions),
          planTaskTitle: planTasks.title,
        })
        .from(studySessions)
        .leftJoin(planTasks, eq(studySessions.planTaskId, planTasks.id))
        .where(where)
        .orderBy(desc(studySessions.startedAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      tx.select({ count: sql<number>`count(*)::int` }).from(studySessions).where(where),
    ]);
    return {
      items: items.map((row) => ({
        ...row,
        planTaskTitle: row.planTaskTitle ?? null,
      })),
      total: totalRow[0]?.count ?? 0,
    };
  }

  /**
   * Whether the user has any FINALIZED completed session on the given UTC calendar date
   * that meets {@link minFocusSeconds} actual focus (roadmap §261 — real work, not a tap-through).
   */
  async hasCompletedOnDate(
    tx: DatabaseTx,
    userId: string,
    date: string,
    minFocusSeconds: number,
  ): Promise<boolean> {
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
          gte(studySessions.actualFocusSeconds, minFocusSeconds),
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

  /**
   * Sum of COMPLETED focus seconds on the given UTC calendar date. No min-focus
   * filter: the daily goal measures accumulation, not per-session reward gating.
   */
  async sumCompletedFocusSecondsOnDate(
    tx: DatabaseTx,
    userId: string,
    date: string,
  ): Promise<number> {
    const dayStart = `${date}T00:00:00Z`;
    const nextDayStart = `${addDays(date, 1)}T00:00:00Z`;
    const rows = await tx
      .select({
        total: sql<number>`coalesce(sum(${studySessions.actualFocusSeconds}), 0)::int`,
      })
      .from(studySessions)
      .where(
        and(
          eq(studySessions.userId, userId),
          eq(studySessions.status, StudySessionStatus.COMPLETED),
          isNotNull(studySessions.endedAt),
          gte(studySessions.startedAt, new Date(dayStart)),
          lt(studySessions.startedAt, new Date(nextDayStart)),
        ),
      );
    return rows[0]?.total ?? 0;
  }

  /**
   * Distinct users with a running focus session started in the last `windowMinutes`.
   * CROSS-USER aggregate — must be called in SERVICE context, and only ever exposed
   * as a bare count (privacy model: no per-user data crosses the RLS boundary).
   */
  async countFocusingNow(tx: DatabaseTx, windowMinutes: number): Promise<number> {
    const rows = await tx
      .select({ n: sql<number>`count(distinct ${studySessions.userId})::int` })
      .from(studySessions)
      .where(
        and(
          eq(studySessions.status, StudySessionStatus.IN_PROGRESS),
          isNull(studySessions.endedAt),
          sql`${studySessions.startedAt} > now() - ${windowMinutes} * interval '1 minute'`,
        ),
      );
    return rows[0]?.n ?? 0;
  }

  async countCompleted(tx: DatabaseTx, userId: string, minFocusSeconds: number): Promise<number> {
    const rows = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(studySessions)
      .where(
        and(
          eq(studySessions.userId, userId),
          eq(studySessions.status, StudySessionStatus.COMPLETED),
          isNotNull(studySessions.endedAt),
          gte(studySessions.actualFocusSeconds, minFocusSeconds),
        ),
      );
    return rows[0]?.count ?? 0;
  }
}
