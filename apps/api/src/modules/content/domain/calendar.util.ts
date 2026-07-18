/**
 * Pure calendar selection for countdown / data-card resolution.
 * Picks the authoritative exam row for a family (users.examType).
 */

import { toIsoDate, todayIso, type IsoDate } from "./date.util";

export interface ExamCandidate {
  examId: string;
  slug: string;
  name: string;
  family: string;
  variant: string | null;
  isCurrent: boolean;
  /** yyyy-mm-dd of the EXAM_DATE event. */
  examDate: IsoDate;
  eventAt: Date;
}
/** Pick today's or the nearest future editorial event, deterministically. */
export function selectNextEvent<T extends { type: string; eventAt: Date }>(
  events: T[],
  today: IsoDate = todayIso(),
): T | null {
  return (
    events
      .filter((event) => toIsoDate(event.eventAt) >= today)
      .sort(
        (left, right) =>
          left.eventAt.getTime() - right.eventAt.getTime() ||
          left.type.localeCompare(right.type),
      )[0] ?? null
  );
}

/**
 * Select the exam used for countdown within a family.
 * 1. Keep only upcoming EXAM_DATE rows (>= today).
 * 2. Prefer an `isCurrent` row within that pool; otherwise pick the nearest.
 * 3. If none upcoming, return null (no silent fallback to past dates).
 */
export function selectExamForCountdown(
  candidates: ExamCandidate[],
  today: IsoDate = todayIso(),
): ExamCandidate | null {
  if (candidates.length === 0) return null;

  const upcoming = candidates
    .filter((candidate) => candidate.examDate >= today)
    .sort((a, b) => a.examDate.localeCompare(b.examDate));

  return (
    upcoming.find((candidate) => candidate.isCurrent) ?? upcoming[0] ?? null
  );
}

/** Map DB rows to selection candidates. */
export function toExamCandidates(
  rows: Array<{
    exam: {
      id: string;
      slug: string;
      name: string;
      family: string;
      variant: string | null;
      isCurrent: boolean;
    };
    event: { eventAt: Date };
  }>,
): ExamCandidate[] {
  return rows.map(({ exam, event }) => ({
    examId: exam.id,
    slug: exam.slug,
    name: exam.name,
    family: exam.family,
    variant: exam.variant,
    isCurrent: exam.isCurrent,
    examDate: toIsoDate(event.eventAt),
    eventAt: event.eventAt,
  }));
}
