/** Star fill for a finished focus session. Presentational total is 3; half steps. */

export const COMPLETION_STAR_TOTAL = 3;

export interface SessionStarFillInput {
  elapsedSec: number;
  plannedSec: number;
  countsAsFocusSession: boolean;
  abandoned?: boolean;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function snapHalf(value: number): number {
  return Math.round(value * 2) / 2;
}

/**
 * Maps elapsed/planned onto 1–3 stars (0.5 steps).
 * Completed sessions never score 0. Too-short (not abandoned) sessions stay at 1.
 */
export function sessionStarFill({
  elapsedSec,
  plannedSec,
  countsAsFocusSession,
  abandoned = false,
}: SessionStarFillInput): number {
  if (!countsAsFocusSession && !abandoned) return 1;

  const planned = plannedSec > 0 ? plannedSec : Math.max(elapsedSec, 1);
  const ratio = clamp(elapsedSec / planned, 0, 1);
  const filled = snapHalf(ratio * COMPLETION_STAR_TOTAL);
  return clamp(filled, 1, COMPLETION_STAR_TOTAL);
}
