/** Whitelisted aggregates crossing the coaching → AI boundary. */
export interface AnalysisCoachContext {
  focus: {
    subjectName: string;
    topicName?: string;
    source: "PHOTO_SIGNAL" | "LOWEST_AVERAGE";
    evidenceCount: number;
  } | null;
  dominantError: { errorType: string; count: number; sharePercent: number } | null;
  notebookStats: {
    savedCount: number;
    reviewedCount: number;
    dueCount: number;
    healedCount: number;
  };
}
