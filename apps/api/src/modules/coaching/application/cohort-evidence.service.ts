import { Inject, Injectable } from "@nestjs/common";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import type {
  CohortStudentSnapshot,
  CohortTriageSnapshot,
  StudentReportSnapshot,
} from "../domain/cohort-evidence";
import {
  FREEZE_TOKENS_PER_MONTH,
  STREAK_LOOKBACK_DAYS,
} from "../domain/coaching.constants";
import { CONTENT_PORT, type ContentPort } from "../domain/content.port";
import {
  addDays,
  todayInIstanbul,
  todayIso,
  type IsoDate,
} from "../domain/date.util";
import { deriveStreak } from "../domain/streak";
import { CohortEvidenceRepository } from "../infrastructure/cohort-evidence.repository";

/**
 * Windows the coach surface reads over. Fixed, not configurable — they are part of the contract.
 * Every window ends on the Europe/Istanbul day, the calendar the weekly report, follow-ups and the
 * coach plan already use, so a roster number never disagrees with the screen beside it.
 *
 * The three W8's student mirror quotes back ("your last 7 days travel") are exported for exactly
 * that reason: a screen that guessed the number would drift from the query the day either changed.
 */
export const ROSTER_WINDOW_DAYS = 7;
/** The roster row's activity strip. */
const ROSTER_DAILY_DAYS = 14;
const REPORT_LONG_WINDOW_DAYS = 28;
export const REPORT_PLAN_WINDOW_DAYS = 14;
export const REPORT_MOOD_WINDOW_DAYS = 14;
const REPORT_MOCK_LIMIT = 10;
const REPORT_PLAN_TASK_LIMIT = 120;

/**
 * The W2 read boundary for the HUMAN coach (W8), sibling to {@link CoachEvidenceService}, which
 * serves the AI. Two consumers, two shapes, one rule: aggregates out, never the student's words.
 *
 * Why not reuse `CoachEvidenceService`: it builds one localized prose snapshot per user by calling
 * seven services. A roster needs numbers for N users in a bounded number of queries, and prose is
 * exactly what a coach surface must not receive. See `domain/cohort-evidence.ts` for the contract.
 */
@Injectable()
export class CohortEvidenceService {
  constructor(
    private readonly repo: CohortEvidenceRepository,
    @Inject(CONTENT_PORT) private readonly content: ContentPort,
    private readonly config: ConfigRegistryService,
  ) {}

  listPlanningTasks(
    studentId: string,
    linkId: string,
    from: string,
    to: string,
    page: number,
    pageSize: number,
  ) {
    return this.repo.planningTasks(studentId, linkId, from, to, page, pageSize);
  }

  /**
   * Roster rows for a set of students: the triage plus the activity strip and the live streak.
   * Batch — eight queries regardless of cohort size. Only the roster screen draws these; everything
   * else that needs flags reads {@link listTriageSnapshots}.
   */
  async listCohortSnapshots(
    studentIds: string[],
    now = new Date(),
  ): Promise<Map<string, CohortStudentSnapshot>> {
    const result = new Map<string, CohortStudentSnapshot>();
    if (studentIds.length === 0) return result;

    const dailySince = addDays(todayInIstanbul(now), -(ROSTER_DAILY_DAYS - 1));
    const [triage, daily, streaks] = await Promise.all([
      this.listTriageSnapshots(studentIds, now),
      this.repo.dailyFocusMinutes(studentIds, dailySince),
      // The student's own UTC day, so coach and student see the same streak.
      this.currentStreaks(studentIds, todayIso(now)),
    ]);
    const dailyBy = minutesByDay(daily);

    for (const [studentId, snapshot] of triage) {
      result.set(studentId, {
        ...snapshot,
        currentStreak: streaks.get(studentId) ?? 0,
        dailyFocusMinutes14d: series(
          dailyBy.get(studentId),
          dailySince,
          ROSTER_DAILY_DAYS,
        ),
      });
    }
    return result;
  }

  /**
   * What the risk rules read, for a set of students: the morning digest (every linked student),
   * the coach's mark and the report's flags. Batch — five queries regardless of cohort size.
   * Students with no data at all still get a row (all-zero / null), because "this student has
   * done nothing" is the single most important thing a coach can be shown.
   */
  async listTriageSnapshots(
    studentIds: string[],
    now = new Date(),
  ): Promise<Map<string, CohortTriageSnapshot>> {
    const result = new Map<string, CohortTriageSnapshot>();
    if (studentIds.length === 0) return result;

    const today = todayInIstanbul(now);
    const since = addDays(today, -(ROSTER_WINDOW_DAYS - 1));
    const minFocusSeconds = await this.minFocusSeconds();

    const [sessions, activity, plans, mocks, moods] = await Promise.all([
      this.repo.sessionTotalsSince(studentIds, since),
      this.repo.activityWindow(studentIds, since, minFocusSeconds),
      this.repo.planTotalsSince(studentIds, since, today),
      this.repo.latestMocks(studentIds),
      this.repo.moodAverageSince(studentIds, since),
    ]);

    const sessionBy = index(sessions);
    const activityBy = index(activity);
    const planBy = index(plans);
    const mockBy = index(mocks);
    const moodBy = index(moods);

    for (const studentId of studentIds) {
      const plan = planBy.get(studentId);
      const mock = mockBy.get(studentId);
      result.set(studentId, {
        studentId,
        lastActiveDate: activityBy.get(studentId)?.lastActiveDate ?? null,
        focusMinutes7d: sessionBy.get(studentId)?.focusMinutes ?? 0,
        sessions7d: sessionBy.get(studentId)?.sessions ?? 0,
        activeDays7d: activityBy.get(studentId)?.activeDays ?? 0,
        // No plan is not 0% completion — a student who planned nothing has not failed anything.
        planCompletionRate7d:
          plan && plan.total > 0 ? plan.done / plan.total : null,
        latestMockNet: mock ? Number(mock.totalNet) : null,
        latestMockAt: mock ? mock.takenAt.toISOString() : null,
        previousMockNetAvg:
          mock?.previousNetAvg != null ? Number(mock.previousNetAvg) : null,
        moodLevel7dAvg: moodBy.get(studentId)?.average ?? null,
      });
    }
    return result;
  }

  /**
   * Single-student detail. Per-user queries are fine here: it is one student on one screen.
   *
   * `mentorshipLinkId` scopes the coach-authored fields on the plan rows to the caller's own link
   * (see `planTaskRows`). Callers without a link — anyone but W8 — simply omit it and get neither
   * `coachNote` nor `assignedByCoach`.
   */
  async getStudentReport(
    studentId: string,
    now = new Date(),
    mentorshipLinkId?: string,
  ): Promise<StudentReportSnapshot> {
    const today = todayInIstanbul(now);
    const since7 = addDays(today, -(ROSTER_WINDOW_DAYS - 1));
    const since28 = addDays(today, -(REPORT_LONG_WINDOW_DAYS - 1));
    const sincePlan = addDays(today, -(REPORT_PLAN_WINDOW_DAYS - 1));
    const sinceMood = addDays(today, -(REPORT_MOOD_WINDOW_DAYS - 1));
    const dailySince = addDays(
      todayInIstanbul(now),
      -(REPORT_LONG_WINDOW_DAYS - 1),
    );
    const ids = [studentId];
    const minFocusSeconds = await this.minFocusSeconds();

    const [
      sessions7,
      sessions28,
      daily,
      activity7,
      activity28,
      streaks,
      currentStreaks,
      plans,
      mockTrend,
      planTasks,
      moodTrend,
    ] = await Promise.all([
      this.repo.sessionTotalsSince(ids, since7),
      this.repo.sessionTotalsSince(ids, since28),
      this.repo.dailyFocusMinutes(ids, dailySince),
      this.repo.activityWindow(ids, since7, minFocusSeconds),
      this.repo.activityWindow(ids, since28, minFocusSeconds),
      this.repo.streaks(ids),
      this.currentStreaks(ids, todayIso(now)),
      this.repo.planTotalsSince(ids, since7, today),
      this.repo.mockTrend(studentId, REPORT_MOCK_LIMIT),
      this.repo.planTaskRows(
        studentId,
        sincePlan,
        REPORT_PLAN_TASK_LIMIT,
        mentorshipLinkId,
      ),
      this.repo.moodTrend(studentId, sinceMood),
    ]);

    const latest = mockTrend[0];
    const [latestMockSubjects, subjects, examNames] = await Promise.all([
      latest ? this.repo.mockSubjects(latest.id) : [],
      latest ? this.content.listExamSubjects(latest.examId) : [],
      this.examNames(mockTrend.map((row) => row.examId)),
    ]);
    const subjectName = new Map(subjects.map((row) => [row.slug, row.name]));
    const plan = plans[0];
    const currentStreak = currentStreaks.get(studentId) ?? 0;

    return {
      activity: {
        lastActiveDate: activity28[0]?.lastActiveDate ?? null,
        currentStreak,
        // `streak_state` only remembers the longest run as of the student's last own read.
        longestStreak: Math.max(streaks[0]?.longestStreak ?? 0, currentStreak),
        sessions7d: sessions7[0]?.sessions ?? 0,
        focusMinutes7d: sessions7[0]?.focusMinutes ?? 0,
        activeDays7d: activity7[0]?.activeDays ?? 0,
        sessions28d: sessions28[0]?.sessions ?? 0,
        focusMinutes28d: sessions28[0]?.focusMinutes ?? 0,
        activeDays28d: activity28[0]?.activeDays ?? 0,
      },
      dailyFocusMinutes28d: series(
        minutesByDay(daily).get(studentId),
        dailySince,
        REPORT_LONG_WINDOW_DAYS,
      ),
      planCompletionRate7d:
        plan && plan.total > 0 ? plan.done / plan.total : null,
      mockTrend: mockTrend.map((row) => ({
        takenAt: row.takenAt.toISOString(),
        totalNet: Number(row.totalNet),
        publisherName: row.publisherName,
        examName: examNames.get(row.examId) ?? null,
      })),
      latestMockSubjects: latestMockSubjects.map((row) => ({
        subjectRef: row.subjectRef,
        subjectName: subjectName.get(row.subjectRef) ?? row.subjectRef,
        correct: row.correct,
        wrong: row.wrong,
        blank: row.blank,
        net: Number(row.net),
      })),
      planTasks: planTasks.map((row) => ({
        taskDate: row.taskDate,
        title: row.title,
        subject: row.subject,
        topic: row.topic,
        status: row.status,
        assignedByCoach: row.assignedByCoach,
        coachNote: row.coachNote,
      })),
      moodTrend: moodTrend.map((row) => ({ date: row.date, level: row.level })),
    };
  }

  /** The focus a session needs to make its day active: the streak's rule and the weekly report's. */
  private minFocusSeconds(): Promise<number> {
    return this.config.get("coaching.session.min_focus_seconds");
  }

  /**
   * Live streaks, derived exactly as the student's own screen derives them
   * (`StreakService.getCoachEvidence`), for the whole cohort in two queries. Never `streak_state`:
   * only the student's own reads refresh that row, so a student who stopped opening the app keeps
   * a streak there that stopped counting the day they left.
   */
  private async currentStreaks(
    studentIds: string[],
    today: IsoDate,
  ): Promise<Map<string, number>> {
    const since = addDays(today, -STREAK_LOOKBACK_DAYS);
    const [active, purchased] = await Promise.all([
      this.repo.activeDatesSince(studentIds, since),
      this.repo.purchasedFreezeDatesSince(studentIds, since),
    ]);
    const activeBy = datesBy(active);
    const purchasedBy = datesBy(purchased);
    return new Map(
      studentIds.map((id) => [
        id,
        deriveStreak(
          today,
          activeBy.get(id) ?? new Set(),
          FREEZE_TOKENS_PER_MONTH,
          purchasedBy.get(id),
        ).currentStreak,
      ]),
    );
  }

  /** Exam names by id; an exam content no longer knows is simply absent. */
  private async examNames(examIds: string[]): Promise<Map<string, string>> {
    const unique = [...new Set(examIds)];
    const exams = await Promise.all(
      unique.map((id) => this.content.getExamById(id)),
    );
    return new Map(
      exams.flatMap((exam) => (exam ? [[exam.id, exam.name] as const] : [])),
    );
  }
}

function index<T extends { userId: string }>(rows: T[]): Map<string, T> {
  return new Map(rows.map((row) => [row.userId, row]));
}

function datesBy(
  rows: { userId: string; date: string }[],
): Map<string, Set<IsoDate>> {
  const result = new Map<string, Set<IsoDate>>();
  for (const row of rows) {
    const dates = result.get(row.userId) ?? new Set<IsoDate>();
    dates.add(row.date);
    result.set(row.userId, dates);
  }
  return result;
}

function minutesByDay(
  rows: { userId: string; day: string; focusMinutes: number }[],
): Map<string, Map<IsoDate, number>> {
  const result = new Map<string, Map<IsoDate, number>>();
  for (const row of rows) {
    const days = result.get(row.userId) ?? new Map<IsoDate, number>();
    days.set(row.day, row.focusMinutes);
    result.set(row.userId, days);
  }
  return result;
}

/** `days` values from `since` on, oldest first; a day without a session is 0. */
function series(
  byDay: Map<IsoDate, number> | undefined,
  since: IsoDate,
  days: number,
): number[] {
  return Array.from(
    { length: days },
    (_, offset) => byDay?.get(addDays(since, offset)) ?? 0,
  );
}
