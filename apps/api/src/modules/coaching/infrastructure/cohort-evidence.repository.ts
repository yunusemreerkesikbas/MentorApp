import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database } from "../../../database/drizzle";
import { withServiceContext } from "../../../database/rls";
import {
  dailyActivity,
  mockExamSubjects,
  mockExams,
  moodCheckins,
  planTasks,
  streakState,
  studySessions,
} from "../../../database/schema";

/**
 * Batch reads behind the coach-facing aggregate boundary (see `domain/cohort-evidence.ts`).
 *
 * Two rules hold everywhere in this file, and they are what make the trust line auditable:
 *   1. **Never `select *`.** Every column is named, so a new free-text column on any of these
 *      tables cannot reach a coach by accident.
 *   2. **One query per fact, for all students at once** (`in (…)` + `group by`). A roster of 20
 *      students costs a fixed handful of round trips, not 20 × N.
 *
 * SERVICE context: these tables have per-user RLS policies and the reader is not the owner. The
 * caller is responsible for having passed `MentorshipLinkService.requireActiveLink` first — this
 * repository trusts the ids it is given and does nothing else to earn that trust.
 */
@Injectable()
export class CohortEvidenceRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /** Completed-session totals since `since`, per student. */
  sessionTotalsSince(
    studentIds: string[],
    since: Date,
  ): Promise<{ userId: string; sessions: number; focusMinutes: number }[]> {
    if (studentIds.length === 0) return Promise.resolve([]);
    return withServiceContext(this.db, (tx) =>
      tx
        .select({
          userId: studySessions.userId,
          sessions: sql<number>`count(*)::int`,
          focusMinutes: sql<number>`(coalesce(sum(${studySessions.actualFocusSeconds}), 0) / 60)::int`,
        })
        .from(studySessions)
        .where(
          and(
            inArray(studySessions.userId, studentIds),
            eq(studySessions.status, "COMPLETED"),
            gte(studySessions.startedAt, since),
          ),
        )
        .groupBy(studySessions.userId),
    );
  }

  /**
   * All-time last active day plus the active-day count since `sinceDate`, per student.
   * "Active" mirrors the streak definition: a completed session OR at least one done task.
   */
  activityWindow(
    studentIds: string[],
    sinceDate: string,
  ): Promise<{ userId: string; lastActiveDate: string | null; activeDays: number }[]> {
    if (studentIds.length === 0) return Promise.resolve([]);
    const isActive = sql`(${dailyActivity.hasSession} = true or ${dailyActivity.tasksDone} > 0)`;
    return withServiceContext(this.db, (tx) =>
      tx
        .select({
          userId: dailyActivity.userId,
          lastActiveDate: sql<
            string | null
          >`max(${dailyActivity.activityDate}) filter (where ${isActive})`,
          activeDays: sql<number>`count(*) filter (where ${isActive} and ${dailyActivity.activityDate} >= ${sinceDate})::int`,
        })
        .from(dailyActivity)
        .where(inArray(dailyActivity.userId, studentIds))
        .groupBy(dailyActivity.userId),
    );
  }

  streaks(
    studentIds: string[],
  ): Promise<{ userId: string; currentStreak: number; longestStreak: number }[]> {
    if (studentIds.length === 0) return Promise.resolve([]);
    return withServiceContext(this.db, (tx) =>
      tx
        .select({
          userId: streakState.userId,
          currentStreak: streakState.currentStreak,
          longestStreak: streakState.longestStreak,
        })
        .from(streakState)
        .where(inArray(streakState.userId, studentIds)),
    );
  }

  /** Planned vs done since `sinceDate`. Counts only — titles come from {@link planTaskRows}. */
  planTotalsSince(
    studentIds: string[],
    sinceDate: string,
  ): Promise<{ userId: string; total: number; done: number }[]> {
    if (studentIds.length === 0) return Promise.resolve([]);
    return withServiceContext(this.db, (tx) =>
      tx
        .select({
          userId: planTasks.userId,
          total: sql<number>`count(*)::int`,
          done: sql<number>`count(*) filter (where ${planTasks.status} = 'DONE')::int`,
        })
        .from(planTasks)
        .where(
          and(inArray(planTasks.userId, studentIds), gte(planTasks.taskDate, sinceDate)),
        )
        .groupBy(planTasks.userId),
    );
  }

  /**
   * Per student: the most recent attempt, plus the mean of the three attempts before it.
   *
   * One pass — the window function computes the baseline while `distinct on` picks the latest, so
   * "is this student's net falling?" costs no extra round trip. `previousNetAvg` is null on a first
   * attempt, which is the honest answer: there is nothing yet to fall from.
   */
  latestMocks(studentIds: string[]): Promise<
    { userId: string; totalNet: string; takenAt: Date; previousNetAvg: string | null }[]
  > {
    if (studentIds.length === 0) return Promise.resolve([]);
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx.execute<{
        user_id: string;
        total_net: string;
        taken_at: Date;
        previous_net_avg: string | null;
      }>(sql`
        select distinct on (${mockExams.userId})
          ${mockExams.userId} as user_id,
          ${mockExams.totalNet} as total_net,
          ${mockExams.takenAt} as taken_at,
          avg(${mockExams.totalNet}) over (
            partition by ${mockExams.userId}
            order by ${mockExams.takenAt} desc
            rows between 1 following and 3 following
          ) as previous_net_avg
        from ${mockExams}
        where ${inArray(mockExams.userId, studentIds)}
        order by ${mockExams.userId}, ${mockExams.takenAt} desc
      `);
      return rows.rows.map((row) => ({
        userId: row.user_id,
        totalNet: row.total_net,
        takenAt: row.taken_at,
        previousNetAvg: row.previous_net_avg,
      }));
    });
  }

  /** Mean check-in level since `sinceDate`, per student. Level only — the note stays behind. */
  moodAverageSince(
    studentIds: string[],
    sinceDate: string,
  ): Promise<{ userId: string; average: number }[]> {
    if (studentIds.length === 0) return Promise.resolve([]);
    return withServiceContext(this.db, (tx) =>
      tx
        .select({
          userId: moodCheckins.userId,
          average: sql<number>`avg(${moodCheckins.mood})::float8`,
        })
        .from(moodCheckins)
        .where(
          and(
            inArray(moodCheckins.userId, studentIds),
            gte(moodCheckins.checkinDate, sinceDate),
          ),
        )
        .groupBy(moodCheckins.userId),
    );
  }

  // --- single-student detail -------------------------------------------------------------

  mockTrend(
    studentId: string,
    limit: number,
  ): Promise<{ id: string; takenAt: Date; totalNet: string; publisherName: string | null }[]> {
    return withServiceContext(this.db, (tx) =>
      tx
        .select({
          id: mockExams.id,
          takenAt: mockExams.takenAt,
          totalNet: mockExams.totalNet,
          publisherName: mockExams.publisherName,
        })
        .from(mockExams)
        .where(eq(mockExams.userId, studentId))
        .orderBy(desc(mockExams.takenAt))
        .limit(limit),
    );
  }

  mockSubjects(mockExamId: string): Promise<
    {
      subjectRef: string;
      correct: number;
      wrong: number;
      blank: number;
      net: string;
    }[]
  > {
    return withServiceContext(this.db, (tx) =>
      tx
        .select({
          subjectRef: mockExamSubjects.subjectRef,
          correct: mockExamSubjects.correct,
          wrong: mockExamSubjects.wrong,
          blank: mockExamSubjects.blank,
          net: mockExamSubjects.net,
        })
        .from(mockExamSubjects)
        .where(eq(mockExamSubjects.mockExamId, mockExamId))
        .orderBy(mockExamSubjects.subjectRef),
    );
  }

  /**
   * Headings, taxonomy labels and status. `description` is absent on purpose — it is the student's
   * own note.
   *
   * `coachNote` and `assignedByCoach` are resolved against `mentorshipLinkId`, not against
   * "is this a MENTORSHIP row": a task assigned by a PREVIOUS coach still carries their note, and
   * projecting it unconditionally would hand it to whoever holds the link today. When no link id
   * is supplied (any non-mentorship caller) both collapse to null/false.
   */
  planTaskRows(
    studentId: string,
    sinceDate: string,
    limit: number,
    mentorshipLinkId?: string,
  ): Promise<
    {
      taskDate: string;
      title: string;
      subject: string | null;
      topic: string | null;
      status: string;
      assignedByCoach: boolean;
      coachNote: string | null;
    }[]
  > {
    const mine = mentorshipLinkId
      ? sql<boolean>`${planTasks.originType} = 'MENTORSHIP' and ${planTasks.originRefId} = ${mentorshipLinkId}`
      : sql<boolean>`false`;
    return withServiceContext(this.db, (tx) =>
      tx
        .select({
          taskDate: planTasks.taskDate,
          title: planTasks.title,
          subject: planTasks.subject,
          topic: planTasks.topic,
          status: planTasks.status,
          assignedByCoach: mine,
          coachNote: sql<string | null>`case when ${mine} then ${planTasks.coachNote} end`,
        })
        .from(planTasks)
        .where(and(eq(planTasks.userId, studentId), gte(planTasks.taskDate, sinceDate)))
        .orderBy(desc(planTasks.taskDate), planTasks.sortOrder)
        .limit(limit),
    );
  }

  moodTrend(
    studentId: string,
    sinceDate: string,
  ): Promise<{ date: string; level: number }[]> {
    return withServiceContext(this.db, (tx) =>
      tx
        .select({ date: moodCheckins.checkinDate, level: moodCheckins.mood })
        .from(moodCheckins)
        .where(
          and(eq(moodCheckins.userId, studentId), gte(moodCheckins.checkinDate, sinceDate)),
        )
        .orderBy(desc(moodCheckins.checkinDate)),
    );
  }
}
