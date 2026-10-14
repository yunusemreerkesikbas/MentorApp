import type { CoachPlanAdaptationInput } from "@mentor/validation";
import type {
  PlanAdaptationKnownWeek,
  PlanWindowDay,
} from "./plan-coach-adaptation-brief-note";

/**
 * "Hafta kuruluyor" (DESIGN.md §9.1): what plays while the coach's preview is on its way. The
 * timings and the arrangement live here; the stage only draws them.
 */
export const STAGE_TIMING = {
  /** One rearrangement of the blocks, and the scene's only clock. */
  beatMs: 900,
  /** One line of what the coach read, before the next. */
  lineMs: 3_600,
  /** From here on the scene says the coach is still at it. */
  slowAfterMs: 12_000,
  /** The blocks gather and the bar fills before the preview opens. */
  arrivalMs: 450,
} as const;

/** How many blocks one day can hold. */
export const STAGE_MAX_ROWS = 6;
/** More than this and the board reads as noise. */
const STAGE_MAX_BLOCKS = 12;

export interface StageScene {
  /** The plan window in order; the lit days are the ones the student picked. */
  columns: { weekday: number; active: boolean }[];
  /** One entry per block: its subject, or null for the neutral swatch. */
  blocks: (string | null)[];
}

export interface StageSlot {
  column: number;
  row: number;
}

/**
 * The scene is built from the student's own answers: the picked days are lit and carry two blocks
 * each, in the picked subjects' colours. A skipped step lights every day and borrows the subjects
 * already waiting in the week. Without the wizard at all (the mood and session invitations) the
 * blocks are those waiting tasks themselves, one each, since moving them is what the coach is
 * doing; a week with nothing waiting has an empty board.
 */
export function buildStageScene({
  days,
  input,
  knownWeek,
}: {
  days: readonly PlanWindowDay[];
  input: CoachPlanAdaptationInput;
  knownWeek: PlanAdaptationKnownWeek;
}): StageScene {
  const picked = input.source === "PLAN" ? (input.studyWeekdays ?? []) : [];
  const focus = input.source === "PLAN" ? (input.focusSubjects ?? []) : [];
  const subjects = focus.length > 0 ? focus : knownWeek.subjects;
  const columns = days.map((day) => ({
    weekday: day.weekday,
    active: picked.length === 0 || picked.includes(day.weekday),
  }));
  const lit = columns.filter((column) => column.active).length;
  const count = Math.min(
    STAGE_MAX_BLOCKS,
    input.source === "PLAN" ? Math.max(4, lit * 2) : knownWeek.pendingCount,
  );
  return {
    columns,
    blocks: Array.from({ length: count }, (_, index) =>
      subjects.length > 0 ? subjects[index % subjects.length]! : null,
    ),
  };
}

/**
 * Where every block stands on a beat. No randomness, so the scene replays the same way and can be
 * tested; half the blocks move on each beat, each by its own stride.
 */
export function stageBeat(scene: StageScene, beat: number): StageSlot[] {
  const lit = scene.columns.flatMap((column, index) =>
    column.active ? [index] : [],
  );
  const count = lit.length;
  // Coprime with the number of lit days, so neighbours start on different ones.
  const stride = count % 2 === 0 ? (count % 3 === 0 ? 5 : 3) : 2;
  const filled = new Map<number, number>();
  return scene.blocks.map((_, index) => {
    const shift = Math.floor((beat + (index % 2)) / 2) * (1 + (index % 3));
    let at = (index * stride + shift) % count;
    // A full day hands the block to the next lit one, so two never share a place.
    while ((filled.get(lit[at]!) ?? 0) >= STAGE_MAX_ROWS) at = (at + 1) % count;
    const column = lit[at]!;
    const row = filled.get(column) ?? 0;
    filled.set(column, row + 1);
    return { column, row };
  });
}

/** Which way Puhu looks: towards the block that leads the beat. */
export function stageGaze(
  scene: StageScene,
  slots: readonly StageSlot[],
  beat: number,
): "left" | "right" | "down" {
  const lead = slots[beat % slots.length];
  // An empty board gives him nothing to follow.
  if (!lead) return "down";
  const across = (lead.column + 0.5) / scene.columns.length;
  return across < 0.38 ? "left" : across > 0.62 ? "right" : "down";
}
