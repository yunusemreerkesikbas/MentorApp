import { planningTaskPage } from "./planning-task-page";
import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, gte, inArray, lte, or, sql } from "drizzle-orm";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database } from "../../../database/drizzle";
import { withServiceContext } from "../../../database/rls";
import {
  dailyActivity,
  mockExamSubjects,
  mockExams,
  moodCheckins,
  planTasks,
  streakFreezes,
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

  planningTasks(
    studentId: string,
    linkId: string,
    from: string,
    to: string,
    page: number,
    pageSize: number,
  ) {
    return planningTaskPage(
      this.db,
      studentId,
      linkId,
      from,
      to,
      page,
      pageSize,
    );
  }

  /**
   * Completed-session totals from the start of `sinceDate`, an Europe/Istanbul day, per student:
   * the same cut the activity strip draws, so a 7-day total is the sum of the strip's last 7 days.
   */
  sessionTotalsSince(
    studentIds: string[],
    sinceDate: string,
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
            sql`${studySessions.startedAt} >= (${sinceDate}::date::timestamp at time zone 'Europe/Istanbul')`,
          ),
        )
        .groupBy(studySessions.userId),
    );
  }

  /**
   * Completed-session minutes per student per Europe/Istanbul day, from `sinceDate` (an Istanbul
   * day) on, each on the Istanbul day it started. The day is cut in Istanbul, not UTC: a session
   * started at 00:30 belongs to the day the student lived it, which is the day the coach's strip
   * draws it on. Text, not `date`, so the
   * driver cannot turn the day into a UTC midnight.
   */
  dailyFocusMinutes(
    studentIds: string[],
    sinceDate: string,
  ): Promise<{ userId: string; day: string; focusMinutes: number }[]> {
    if (studentIds.length === 0) return Promise.resolve([]);
    const day = sql<string>`to_char(${studySessions.startedAt} at time zone 'Europe/Istanbul', 'YYYY-MM-DD')`;
    return withServiceContext(this.db, (tx) =>
      tx
        .select({
          userId: studySessions.userId,
          day,
          focusMinutes: sql<number>`(coalesce(sum(${studySessions.actualFocusSeconds}), 0) / 60)::int`,
        })
        .from(studySessions)
        .where(
          and(
            inArray(studySessions.userId, studentIds),
            eq(studySessions.status, "COMPLETED"),
            sql`${studySessions.startedAt} >= (${sinceDate}::date::timestamp at time zone 'Europe/Istanbul')`,
          ),
        )
        .groupBy(studySessions.userId, day),
    );
  }

  /**
   * Active days (≥1 session OR ≥1 done task) on/after `sinceDate`, per student — the batch form of
   * `DailyActivityRepository.listActiveDatesSince`, for deriving the live streak.
   */
  activeDatesSince(
    studentIds: string[],
    sinceDate: string,
  ): Promise<{ userId: string; date: string }[]> {
    if (studentIds.length === 0) return Promise.resolve([]);
    return withServiceContext(this.db, (tx) =>
      tx
        .select({ userId: dailyActivity.userId, date: dailyActivity.activityDate })
        .from(dailyActivity)
        .where(
          and(
            inArray(dailyActivity.userId, studentIds),
            gte(dailyActivity.activityDate, sinceDate),
            or(
              eq(dailyActivity.hasSession, true),
              sql`${dailyActivity.tasksDone} > 0`,
            ),
          ),
        ),
    );
  }

  /** Coin-purchased freeze days on/after `sinceDate`, per student (batch `StreakFreezeRepository`). */
  purchasedFreezeDatesSince(
    studentIds: string[],
    sinceDate: string,
  ): Promise<{ userId: string; date: string }[]> {
    if (studentIds.length === 0) return Promise.resolve([]);
    return withServiceContext(this.db, (tx) =>
      tx
        .select({ userId: streakFreezes.userId, date: streakFreezes.date })
        .from(streakFreezes)
        .where(
          and(
            inArray(streakFreezes.userId, studentIds),
            gte(streakFreezes.date, sinceDate),
          ),
        ),
    );
  }

  /**
   * All-time last active day plus the active-day count since `sinceDate`, per student, both on
   * Europe/Istanbul days. "Active" mirrors the streak definition: a qualifying completed session
   * (focus ≥ `minFocusSeconds`) OR at least one done task.
   *
   * Session days come from `study_sessions`, not `daily_activity.has_session`: the ledger stamps a
   * session on its UTC day, which puts a 00:30 Istanbul session on yesterday. Task days stay on the
   * ledger — they are the plan's own calendar date, with no clock to convert. Text, not `date`, so
   * the driver cannot turn the day into a UTC midnight.
   */
  activityWindow(
    studentIds: string[],
    sinceDate: string,
    minFocusSeconds: number,
  ): Promise<
    { userId: string; lastActiveDate: string | null; activeDays: number }[]
  > {
    if (studentIds.length === 0) return Promise.resolve([]);
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx.execute<{
        user_id: string;
        last_active_date: string;
        active_days: number;
      }>(sql`
        with days as (
          select ${studySessions.userId} as user_id,
                 (${studySessions.startedAt} at time zone 'Europe/Istanbul')::date as day
          from ${studySessions}
          where ${inArray(studySessions.userId, studentIds)}
            and ${studySessions.status} = 'COMPLETED'
            and ${studySessions.endedAt} is not null
            and ${studySessions.actualFocusSeconds} >= ${minFocusSeconds}
          union
          select ${dailyActivity.userId}, ${dailyActivity.activityDate}
          from ${dailyActivity}
          where ${inArray(dailyActivity.userId, studentIds)}
            and ${dailyActivity.tasksDone} > 0
        )
        select user_id,
               to_char(max(day), 'YYYY-MM-DD') as last_active_date,
               count(*) filter (where day >= ${sinceDate}::date)::int as active_days
        from days
        group by user_id
      `);
      return rows.rows.map((row) => ({
        userId: row.user_id,
        lastActiveDate: row.last_active_date,
        activeDays: Number(row.active_days),
      }));
    });
  }

  streaks(
    studentIds: string[],
  ): Promise<
    { userId: string; currentStreak: number; longestStreak: number }[]
  > {
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

  /**
   * Planned vs done from `sinceDate` through `untilDate` (today). Counts only — titles come from
   * {@link planTaskRows}. The upper bound matters: a week the coach assigned ahead is planned but
   * not yet due, and counting it would read as a student falling behind on days still to come.
   * For the same reason a task dated today counts only once it is done: the day is not over, and a
   * coach planning the week on its first day must not flag the student with it.
   */
  planTotalsSince(
    studentIds: string[],
    sinceDate: string,
    untilDate: string,
  ): Promise<{ userId: string; total: number; done: number }[]> {
    if (studentIds.length === 0) return Promise.resolve([]);
    return withServiceContext(this.db, (tx) =>
      tx
        .select({
          userId: planTasks.userId,
          total: sql<number>`count(*) filter (where ${planTasks.taskDate} < ${untilDate} or ${planTasks.status} = 'DONE')::int`,
          done: sql<number>`count(*) filter (where ${planTasks.status} = 'DONE')::int`,
        })
        .from(planTasks)
        .where(
          and(
            inArray(planTasks.userId, studentIds),
            gte(planTasks.taskDate, sinceDate),
            lte(planTasks.taskDate, untilDate),
          ),
        )
        .groupBy(planTasks.userId),
    );
  }

  /**
   * Per student: the most recent attempt, plus the mean of up to three earlier attempts OF THE SAME
   * EXAM (`exam_id`, which also pins the family: an exam belongs to exactly one).
   *
   * One pass — the window function computes the baseline while `distinct on` picks the latest, so
   * "is this student's net falling?" costs no extra round trip. The window is partitioned by exam
   * because nets on different exams share no scale: a first ALES attempt after two KPSS mocks is
   * not a drop. `previousNetAvg` is null on a first attempt of that exam, which is the honest
   * answer: there is nothing yet to fall from.
   */
  latestMocks(studentIds: string[]): Promise<
    {
      userId: string;
      totalNet: string;
      takenAt: Date;
      previousNetAvg: string | null;
    }[]
  > {
    if (studentIds.length === 0) return Promise.resolve([]);
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx.execute<{
        user_id: string;
        total_net: string;
        taken_at: Date | string;
        previous_net_avg: string | null;
      }>(sql`
        select distinct on (${mockExams.userId})
          ${mockExams.userId} as user_id,
          ${mockExams.totalNet} as total_net,
          ${mockExams.takenAt} as taken_at,
          avg(${mockExams.totalNet}) over (
            partition by ${mockExams.userId}, ${mockExams.examId}
            order by ${mockExams.takenAt} desc, ${mockExams.id} desc
            rows between 1 following and 3 following
          ) as previous_net_avg
        from ${mockExams}
        where ${inArray(mockExams.userId, studentIds)}
        order by ${mockExams.userId}, ${mockExams.takenAt} desc, ${mockExams.id} desc
      `);
      return rows.rows.map((row) => ({
        userId: row.user_id,
        totalNet: row.total_net,
        takenAt:
          row.taken_at instanceof Date ? row.taken_at : new Date(row.taken_at),
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
  ): Promise<
    {
      id: string;
      examId: string;
      takenAt: Date;
      totalNet: string;
      publisherName: string | null;
    }[]
  > {
    return withServiceContext(this.db, (tx) =>
      tx
        .select({
          id: mockExams.id,
          examId: mockExams.examId,
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
          coachNote: sql<
            string | null
          >`case when ${mine} then ${planTasks.coachNote} end`,
        })
        .from(planTasks)
        .where(
          and(
            eq(planTasks.userId, studentId),
            gte(planTasks.taskDate, sinceDate),
          ),
        )
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
          and(
            eq(moodCheckins.userId, studentId),
            gte(moodCheckins.checkinDate, sinceDate),
          ),
        )
        .orderBy(desc(moodCheckins.checkinDate)),
    );
  }
}
