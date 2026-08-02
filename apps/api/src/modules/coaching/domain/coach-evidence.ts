import type {
  CoachUsedEvidenceDto,
  WeeklyFocusTimeBandId,
} from "@mentor/types";

export type CoachMoodTrend = "UP" | "DOWN" | "STABLE" | "UNKNOWN";

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
  evidence: CoachUsedEvidenceDto[];
}
