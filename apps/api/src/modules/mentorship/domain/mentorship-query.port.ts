import type { MentorshipRiskFlagId } from "@mentor/types";

/**
 * Cross-module read seam for mentorship-backed notification rules (AGENTS §2).
 * Implemented by the mentorship module — notifications never touches `coach_students`.
 *
 * Mirrors `coaching/domain/coaching-query.port.ts`: the owning module computes WHO should hear
 * something and why, and notifications only decides how to say it. Risk evaluation, its thresholds
 * and the link table all stay behind this line.
 */
export const MENTORSHIP_QUERY_PORT = Symbol("MENTORSHIP_QUERY_PORT");

export interface CoachRiskDigestStudent {
  studentId: string;
  displayName: string;
  /** Non-empty by construction — a student with no flags is not in the digest. */
  flags: MentorshipRiskFlagId[];
}

export interface CoachRiskDigestCandidate {
  coachId: string;
  email: string;
  displayName: string;
  /** Non-empty by construction — a coach with nothing to hear is not a candidate. */
  students: CoachRiskDigestStudent[];
}

export interface MentorshipQueryPort {
  /**
   * Coaches holding at least one ACTIVE link to a student who currently trips a risk rule.
   * An empty list means "no news", which is the common case and costs one query.
   *
   * Unbounded on purpose while the cohort is small: one batch snapshot call covers every linked
   * student at once (fixed round trips, not per coach). If the active-student quota is ever raised
   * far beyond its 500 ceiling, this needs paging by coach before the `in (…)` list does.
   */
  listRiskDigestCandidates(now: Date): Promise<CoachRiskDigestCandidate[]>;
}
