/**
 * Cross-module read seam for coaching-backed notification rules (AGENTS §2).
 * Implemented by coaching module — notifications never touches coaching tables.
 */
export const COACHING_QUERY_PORT = Symbol("COACHING_QUERY_PORT");

export interface DailyReminderCandidate {
  userId: string;
  email: string;
  displayName: string;
}

export interface NotebookReviewCandidate extends DailyReminderCandidate {
  /** How many entries are due — the notification says the number, so it has to come with it. */
  dueCount: number;
}

export interface CoachingQueryPort {
  /** Active users with no study session AND no mood check-in on `dateIso` (YYYY-MM-DD). */
  listDailyReminderCandidates(dateIso: string): Promise<DailyReminderCandidate[]>;
  /** Active users with at least one mistake-notebook entry due for review at `now`. */
  listNotebookReviewCandidates(now: Date): Promise<NotebookReviewCandidate[]>;
}
