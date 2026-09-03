import { Injectable } from "@nestjs/common";
import type {
  CohortStudentSnapshot,
  StudentReportSnapshot,
} from "../domain/cohort-evidence";
import { addDays, todayIso } from "../domain/date.util";
import { CohortEvidenceRepository } from "../infrastructure/cohort-evidence.repository";

/** Windows the coach surface reads over. Fixed, not configurable — they are part of the contract. */
const ROSTER_WINDOW_DAYS = 7;
const REPORT_LONG_WINDOW_DAYS = 28;
const REPORT_PLAN_WINDOW_DAYS = 14;
const REPORT_MOOD_WINDOW_DAYS = 14;
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
  constructor(private readonly repo: CohortEvidenceRepository) {}

  /**
   * Roster metrics for a set of students. Batch — six queries regardless of cohort size.
   * Students with no data at all still get a row (all-zero / null), because "this student has
   * done nothing" is the single most important thing a coach can be shown.
   */
  async listCohortSnapshots(
    studentIds: string[],
    now = new Date(),
  ): Promise<Map<string, CohortStudentSnapshot>> {
    const result = new Map<string, CohortStudentSnapshot>();
    if (studentIds.length === 0) return result;

    const today = todayIso(now);
    const since = addDays(today, -(ROSTER_WINDOW_DAYS - 1));
    const sinceDate = new Date(`${since}T00:00:00.000Z`);

    const [sessions, activity, streaks, plans, mocks, moods] = await Promise.all([
      this.repo.sessionTotalsSince(studentIds, sinceDate),
      this.repo.activityWindow(studentIds, since),
      this.repo.streaks(studentIds),
      this.repo.planTotalsSince(studentIds, since),
      this.repo.latestMocks(studentIds),
      this.repo.moodAverageSince(studentIds, since),
    ]);

    const sessionBy = index(sessions);
    const activityBy = index(activity);
    const streakBy = index(streaks);
    const planBy = index(plans);
    const mockBy = index(mocks);
    const moodBy = index(moods);

    for (const studentId of studentIds) {
      const plan = planBy.get(studentId);
      const mock = mockBy.get(studentId);
      result.set(studentId, {
        studentId,
        lastActiveDate: activityBy.get(studentId)?.lastActiveDate ?? null,
        currentStreak: streakBy.get(studentId)?.currentStreak ?? 0,
        focusMinutes7d: sessionBy.get(studentId)?.focusMinutes ?? 0,
        sessions7d: sessionBy.get(studentId)?.sessions ?? 0,
        activeDays7d: activityBy.get(studentId)?.activeDays ?? 0,
        // No plan is not 0% completion — a student who planned nothing has not failed anything.
        planCompletionRate7d: plan && plan.total > 0 ? plan.done / plan.total : null,
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
    const today = todayIso(now);
    const since7 = addDays(today, -(ROSTER_WINDOW_DAYS - 1));
    const since28 = addDays(today, -(REPORT_LONG_WINDOW_DAYS - 1));
    const sincePlan = addDays(today, -(REPORT_PLAN_WINDOW_DAYS - 1));
    const sinceMood = addDays(today, -(REPORT_MOOD_WINDOW_DAYS - 1));
    const ids = [studentId];

    const [
      sessions7,
      sessions28,
      activity7,
      activity28,
      streaks,
      plans,
      mockTrend,
      planTasks,
      moodTrend,
    ] = await Promise.all([
      this.repo.sessionTotalsSince(ids, new Date(`${since7}T00:00:00.000Z`)),
      this.repo.sessionTotalsSince(ids, new Date(`${since28}T00:00:00.000Z`)),
      this.repo.activityWindow(ids, since7),
      this.repo.activityWindow(ids, since28),
      this.repo.streaks(ids),
      this.repo.planTotalsSince(ids, since7),
      this.repo.mockTrend(studentId, REPORT_MOCK_LIMIT),
      this.repo.planTaskRows(studentId, sincePlan, REPORT_PLAN_TASK_LIMIT, mentorshipLinkId),
      this.repo.moodTrend(studentId, sinceMood),
    ]);

    const latestMockId = mockTrend[0]?.id;
    const latestMockSubjects = latestMockId
      ? await this.repo.mockSubjects(latestMockId)
      : [];
    const plan = plans[0];

    return {
      activity: {
        lastActiveDate: activity28[0]?.lastActiveDate ?? null,
        currentStreak: streaks[0]?.currentStreak ?? 0,
        longestStreak: streaks[0]?.longestStreak ?? 0,
        sessions7d: sessions7[0]?.sessions ?? 0,
        focusMinutes7d: sessions7[0]?.focusMinutes ?? 0,
        activeDays7d: activity7[0]?.activeDays ?? 0,
        sessions28d: sessions28[0]?.sessions ?? 0,
        focusMinutes28d: sessions28[0]?.focusMinutes ?? 0,
        activeDays28d: activity28[0]?.activeDays ?? 0,
      },
      planCompletionRate7d: plan && plan.total > 0 ? plan.done / plan.total : null,
      mockTrend: mockTrend.map((row) => ({
        takenAt: row.takenAt.toISOString(),
        totalNet: Number(row.totalNet),
        publisherName: row.publisherName,
      })),
      latestMockSubjects: latestMockSubjects.map((row) => ({
        subjectRef: row.subjectRef,
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
}

function index<T extends { userId: string }>(rows: T[]): Map<string, T> {
  return new Map(rows.map((row) => [row.userId, row]));
}
