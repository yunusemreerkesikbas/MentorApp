/**
 * ContentPort — coaching's cross-track seam to W1 content (plan §4 contract #1, #2).
 *
 * The content module does not exist yet, so coaching owns this interface and binds a
 * temporary in-module stub (see `infrastructure/content-stub.adapter.ts`). When W1 ships
 * `ContentService`, the binding flips to an adapter delegating to it — this interface and
 * every coaching call site stay unchanged (Ports & Adapters, AGENTS §3).
 *
 * Contract rules:
 *  - "Which exam" is identity-owned (`users.examType`); coaching passes it here, never re-stores it.
 *  - The countdown date is authoritative/verified content (guardrail §4 #1) — NEVER `users.examDate`.
 *  - No FK / no cross-module table access: the boundary is this method signature.
 */

export const CONTENT_PORT = Symbol("CONTENT_PORT");

/** Verified exam-calendar data for a given exam type (ready to render). */
export interface ExamCalendar {
  examType: string;
  examName: string;
  /** Authoritative exam date, yyyy-mm-dd. */
  examDate: string;
  /** Trust metadata (guardrail §4 #1). */
  source: string;
  sourceUrl: string;
}

/** The net-scoring rule for an exam (unused by this slice; included for W2-b deneme analysis). */
export interface NetRule {
  kind: string;
  divisor: number;
}

export interface ContentPort {
  /**
   * Resolve the verified exam calendar for an exam type, or `null` when no exam type is set
   * or the calendar has no authoritative date yet. Coaching must NOT fall back to any other
   * source (no silent fallback — plan §6 #5).
   */
  getExamCalendar(examType: string | null | undefined): Promise<ExamCalendar | null>;

  /** Net-scoring rule for an exam type (reserved for W2-b; not used in this slice). */
  getNetRule(examType: string | null | undefined): Promise<NetRule | null>;
}
