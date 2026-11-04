/** Frozen, backend-computed facts included with the same owned weekly recap. */
export interface WeeklyDeepAnalysisDto {
  metrics: Array<{
    id: "FOCUS_MINUTES" | "ACTIVE_DAYS" | "PLAN_TASKS";
    current: number;
    previous: number | null;
    delta: number | null;
    message: string;
  }>;
  subjects: Array<{
    subjectRef: string;
    subjectName: string;
    averageNet: string | null;
    previousAverageNet: string | null;
    delta: string | null;
    mockExamCount: number;
    previousMockExamCount: number;
    focusMinutes: number;
    completedTaskCount: number;
    trend: "UP" | "DOWN" | "STEADY" | "EARLY" | "NO_EXAM";
    message: string;
  }>;
  evidenceMessage: string;
}
