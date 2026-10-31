import type {
  CoachPlanAdaptationBriefDto,
  CoachUsedEvidenceDto,
} from "@mentor/types";

/**
 * "Şehrin üstünde" (DESIGN.md §9.1): while the coach's preview is on its way, what it read drops
 * in as paper notes, one per line. The timings live here; the stage only draws them.
 */
export const STAGE_TIMING = {
  /** One note, before the next drops. The scene's only clock. */
  lineMs: 3_600,
  /** From here on the scene says the coach is still at it. */
  slowAfterMs: 12_000,
  /** The ready title shows and the pile leaves before the preview opens. */
  arrivalMs: 1_200,
} as const;

/** The API sends at most this many too (`PLAN_EVIDENCE_MAX`). */
export const STAGE_MAX_NOTES = 6;

/** The notes are the coach's own evidence, in its order; no brief means no notes. */
export function stageNotes(
  brief: CoachPlanAdaptationBriefDto | null,
): CoachUsedEvidenceDto[] {
  return brief ? brief.evidence.slice(0, STAGE_MAX_NOTES) : [];
}

/** Which note is on top: a new one every line, round again after the last. */
export function stageNoteIndex(elapsedMs: number, count: number): number {
  return count === 0 ? 0 : Math.floor(elapsedMs / STAGE_TIMING.lineMs) % count;
}

/**
 * Blank sheets under the top note: one per note already read, never more than two, and never more
 * than the other notes there are.
 */
export function stagePileDepth(elapsedMs: number, count: number): 0 | 1 | 2 {
  const read = Math.floor(elapsedMs / STAGE_TIMING.lineMs);
  return Math.max(0, Math.min(2, read, count - 1)) as 0 | 1 | 2;
}
