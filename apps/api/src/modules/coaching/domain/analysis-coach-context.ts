/** Whitelisted aggregates crossing the coaching → AI boundary. */
export interface AnalysisCoachContext {
  focus: {
    subjectName: string;
    topicName?: string;
    source: "PHOTO_SIGNAL" | "LOWEST_AVERAGE";
    evidenceCount: number;
  } | null;
  /** Focus subject's latest-minus-previous net; FIRST until two comparable points exist. */
  focusTrend: {
    direction: "FIRST" | "UP" | "DOWN" | "STEADY";
    recentDelta: string | null;
  } | null;
  /** Most repeated mistake-notebook topics, most cards first (at most three). */
  topics: Array<{ subjectName: string; topicName: string; count: number }>;
  /** Where the latest improvement loop stands; null before the first loop. */
  cycle: { practiced: boolean; measured: boolean; closed: boolean } | null;
  dominantError: { errorType: string; count: number; sharePercent: number } | null;
  notebookStats: {
    savedCount: number;
    reviewedCount: number;
    dueCount: number;
    healedCount: number;
  };
}
