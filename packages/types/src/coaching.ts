/**
 * Coaching API contracts (W2 daily loop + mood) — shared by api (producer) and
 * web/mobile/panel (consumers). The composite `TodayPanelResponse` is the shape the
 * Panel screen renders in ONE server round-trip (no FE recomputation — §engineering-principles).
 *
 * All values are server-computed and ready to display: the countdown days come from the
 * verified content calendar (guardrail §4 #1), the streak from daily activity, and every
 * user-facing line is backend-localized (no AI on these surfaces — §4 #5).
 */

export type PlanTaskStatus = "PENDING" | "DONE";
export type StudySessionStatus = "IN_PROGRESS" | "COMPLETED" | "ABANDONED";
export type SessionPresetId = "25_5" | "50_10";

/** Projection of a `plan_tasks` row. */
export interface PlanTaskDto {
  id: string;
  title: string;
  /** Soft-ref to the content subject taxonomy (display name), nullable. */
  subject: string | null;
  status: PlanTaskStatus;
  sortOrder: number;
  taskDate: string; // yyyy-mm-dd
}

/** Projection of a `study_sessions` row. */
export interface StudySessionDto {
  id: string;
  preset: SessionPresetId;
  status: StudySessionStatus;
  subject: string | null;
  startedAt: string; // ISO datetime
  endedAt: string | null; // ISO datetime
  actualFocusSeconds: number;
}

/** Streak summary derived server-side from `daily_activity` / `streak_state`. */
export interface StreakSummaryDto {
  currentStreak: number;
  longestStreak: number;
  freezeTokens: number;
}

/**
 * Calm countdown — sourced from the verified exam calendar via the content port
 * (never `users.examDate`). `null` when the user has no exam type set or the
 * calendar has no authoritative date yet (no silent fallback — plan §6 #5).
 */
export interface CountdownDto {
  examType: string;
  examName: string;
  /** Computed server-side; the client only displays it. */
  daysRemaining: number;
  /** Pre-formatted authoritative date for display (Turkish). */
  examDateLabel: string;
  source: string;
  sourceUrl: string;
}

/** Pomodoro presets (plan §3 Slice 2: "25_5" | "50_10"). */
export interface SessionPresetDto {
  id: SessionPresetId;
  label: string;
  focusMinutes: number;
  breakMinutes: number;
}

/** Today's mood check-in + its rule-based encouragement (mood is null if not set today). */
export interface MoodCheckinDto {
  checkinDate: string; // yyyy-mm-dd
  mood: number; // 1..5
  /** Stable machine code for the rule-based bucket (client branches on this, not copy). */
  code: string;
  /** Backend-localized encouraging line (display verbatim). */
  message: string;
}

/* ------------------------------- mock exams --------------------------------- */

export interface MockExamSubjectDto {
  subjectRef: string;
  subjectName: string;
  correct: number;
  wrong: number;
  blank: number;
  /** Server-computed net (string transport). */
  net: string;
}

export interface MockExamDto {
  id: string;
  examId: string;
  examName: string;
  takenAt: string;
  totalNet: string;
  subjects: MockExamSubjectDto[];
}

export interface MockExamTrendPointDto {
  id: string;
  takenAt: string;
  totalNet: string;
  examName: string;
}

export interface SubjectStrengthDto {
  subjectRef: string;
  subjectName: string;
  averageNet: string;
  attemptCount: number;
}

/** Personal deneme analysis — no ranking (guardrail §0). */
export interface CoachingAnalysisDto {
  trend: MockExamTrendPointDto[];
  subjects: SubjectStrengthDto[];
}

/** Composite panel payload — one request → whole daily hub. */
export interface TodayPanelResponse {
  greetingName: string;
  /** Rule-based, backend-localized motivational line (no AI on this surface). */
  motivationalLine: string;
  /** `null` when no exam type / no authoritative date (see CountdownDto). */
  countdown: CountdownDto | null;
  streak: StreakSummaryDto;
  tasks: PlanTaskDto[];
  sessionPresets: SessionPresetDto[];
  /** Today's mood check-in if the user already checked in, else `null`. */
  mood: MoodCheckinDto | null;
}
