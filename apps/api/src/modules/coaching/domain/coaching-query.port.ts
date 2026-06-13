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

export interface CoachingQueryPort {
  /** Active users with no study session AND no mood check-in on `dateIso` (YYYY-MM-DD). */
  listDailyReminderCandidates(dateIso: string): Promise<DailyReminderCandidate[]>;
}
