import type {
  CoachUsedEvidenceDto,
  SubjectStrengthDto,
  WeeklyFocusTimeBandId,
} from "@mentor/types";

export type CoachMoodTrend = "UP" | "DOWN" | "STABLE" | "UNKNOWN";

/** Coarse exam proximity. The day count itself never leaves this module (§4 #1). */
export type CoachExamPhase = "FAR" | "MID" | "FINAL";

export interface CoachRhythmEvidence {
  todayFocusMinutes: number;
  sessions7d: number;
  focusMinutes7d: number;
  activeDays7d: number;
  averageSessionMinutes7d: number;
  sessions28d: number;
  focusMinutes28d: number;
  activeDays28d: number;
  averageSessionMinutes28d: number;
  dominantTimeBand: WeeklyFocusTimeBandId | null;
  lastActiveAt: string | null;
}

export interface CoachEvidenceSnapshot {
  examType: string | null;
  dailyFocusGoalMinutes: number | null;
  moodLevel: number | null;
  moodTrend: CoachMoodTrend;
  planCompletionRate: number | null;
  /** Structural backend-only action candidate; never rendered or sent to the model. */
  pendingAiCoachPlanTaskId: string | null;
  /** Taxonomy names, weakest first (at most two). For deterministic callers, not the prompt. */
  weakSubjects: string[];
  /** The analysis focus subject (repeated notebook topic or lowest average), if any. */
  focusSubject: string | null;
  examPhase: CoachExamPhase | null;
  activeDays28d: number | null;
  averageSessionMinutes28d: number | null;
  /** How much of the student's own record was read; counts only. */
  coverage: { mockCount: number; notebookCount: number; sessions28d: number };
  evidence: CoachUsedEvidenceDto[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Both dates are yyyy-mm-dd. A past or unreadable date has no phase. */
export function examPhaseFor(
  examDate: string,
  today: string,
): CoachExamPhase | null {
  const days =
    (Date.parse(`${examDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) /
    DAY_MS;
  if (!Number.isFinite(days) || days < 0) return null;
  if (days < 30) return "FINAL";
  return days <= 90 ? "MID" : "FAR";
}

/**
 * Share of the questions answered, over the recent attempts the analysis focus reads; the lifetime
 * average only when no recent window exists. Null without a question count to divide by.
 */
function weaknessPercent(subject: SubjectStrengthDto): number | null {
  if (subject.recentAverageNet != null && subject.questionCount) {
    return (Number(subject.recentAverageNet) / subject.questionCount) * 100;
  }
  return subject.normalizedAveragePercent == null
    ? null
    : Number(subject.normalizedAveragePercent);
}

/**
 * Lowest share first, like the analysis focus. "Weakest" needs something to be weaker than, so
 * one ranked subject names none and two name one.
 */
export function weakestSubjects(
  subjects: readonly SubjectStrengthDto[],
  limit = 2,
): SubjectStrengthDto[] {
  const ranked = subjects
    .flatMap((subject) => {
      const percent = weaknessPercent(subject);
      return percent === null ? [] : [{ subject, percent }];
    })
    .sort(
      (a, b) =>
        a.percent - b.percent ||
        a.subject.subjectRef.localeCompare(b.subject.subjectRef),
    )
    .map((row) => row.subject);
  return ranked.slice(0, Math.min(limit, ranked.length - 1));
}
