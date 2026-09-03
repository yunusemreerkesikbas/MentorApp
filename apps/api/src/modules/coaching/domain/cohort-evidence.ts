/**
 * What a HUMAN coach may see about their students (W2 → W8 boundary).
 *
 * This file is the contract for guardrail §4 #5 — the AI→teacher trust line. Everything a coach
 * ever learns about a student is one of the shapes below, and every one of them is a number, a
 * date, a status or a task title the student themselves wrote as a heading.
 *
 * DELIBERATELY ABSENT, and never to be added here:
 *   study_sessions.struggleNote / .aiReflection / .sessionMood  — free text and raw affect
 *   mood_checkins.struggleNote / .aiReflection                  — the confession the trust line protects
 *   plan_tasks.description                                      — the note behind the title
 *   mistake_notebook_entries.*                                  — private by nature
 *   coach_messages / coach_memory* / coach_profiles             — the AI companion's own record
 *   vision_boards.*, forum_*, users.email / .bio                — out of scope / PII
 *   subscriptions.*                                             — the coach is not the biller
 *
 * A coach gets performance, activity and actionable flags. A student's words stay with the student.
 *
 * ONE EXCEPTION, and why it is not one:
 *   plan_tasks.coach_note — the coach's OWN words, written by them, read back by them, and only on
 *   rows their own live link authored. It is a separate column from `description` for exactly this
 *   reason. The rule was never "no free text on plan_tasks"; it is "the student's words stay with
 *   the student". `description` remains absent, and `coach_note` is projected only where
 *   `origin_ref_id` matches the reading coach's link — a coach never reads a previous coach's note.
 */

/** One roster row. Computed for N students in a fixed number of batch queries, never per student. */
export interface CohortStudentSnapshot {
  studentId: string;
  /** Last day with a completed session or a done task (`daily_activity`), all-time. */
  lastActiveDate: string | null;
  currentStreak: number;
  focusMinutes7d: number;
  sessions7d: number;
  activeDays7d: number;
  /** 0..1 over the last 7 days; null when nothing was planned (no plan ≠ 0% completion). */
  planCompletionRate7d: number | null;
  latestMockNet: number | null;
  latestMockAt: string | null;
  /** Mean net of the three attempts before the latest; null on a first attempt. */
  previousMockNetAvg: number | null;
  /** Mean of the last 7 days' check-ins, 1..5; null when the student did not check in. */
  moodLevel7dAvg: number | null;
}

/** The single-student detail view. Same rules, more depth. */
export interface StudentReportSnapshot {
  activity: {
    lastActiveDate: string | null;
    currentStreak: number;
    longestStreak: number;
    sessions7d: number;
    focusMinutes7d: number;
    activeDays7d: number;
    sessions28d: number;
    focusMinutes28d: number;
    activeDays28d: number;
  };
  planCompletionRate7d: number | null;
  /** Newest first. */
  mockTrend: {
    takenAt: string;
    totalNet: number;
    publisherName: string | null;
  }[];
  /** Subject breakdown of the most recent attempt only — the weakness map the coach acts on. */
  latestMockSubjects: {
    subjectRef: string;
    correct: number;
    wrong: number;
    blank: number;
    net: number;
  }[];
  /**
   * Headings and taxonomy labels. `description` is the student's own note and does not travel;
   * `coachNote` does, but only on rows the READING coach's link authored (see the header).
   */
  planTasks: {
    taskDate: string;
    title: string;
    subject: string | null;
    topic: string | null;
    status: string;
    assignedByCoach: boolean;
    coachNote: string | null;
  }[];
  /** Level only (1..5). The optional note next to it in `mood_checkins` never leaves the student. */
  moodTrend: { date: string; level: number }[];
}
