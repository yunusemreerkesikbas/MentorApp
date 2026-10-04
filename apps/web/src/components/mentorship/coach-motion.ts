import type { CSSProperties } from "react";

/**
 * The coach surface's motion (DESIGN.md §9.1): a measured work tool, ease-out only, no bounce.
 * framer transitions take seconds; CSS lives in `coach-theme.css` with the same curve.
 */
export const COACH_EASE = [0.22, 1, 0.36, 1] as const;

/** The sibling index a `.coach-draw-*` class staggers by. */
export function drawOrder(i: number): CSSProperties {
  return { "--i": i } as CSSProperties;
}

/** Micro and chrome layer: a tab crossfade, a day chip, a toggle. */
export const COACH_QUICK = { duration: 0.15, ease: COACH_EASE } as const;

/** Content layer: a section opening, a draft row entering, the note switching modes. */
export const COACH_FAST = { duration: 0.25, ease: COACH_EASE } as const;

/** The round's progress moment; the whole moment stays under 400 ms. */
export const COACH_PROGRESS = { duration: 0.3, ease: COACH_EASE } as const;

/** How long a drawn ✓ shows before its panel closes. Skipped under reduced motion. */
export const COACH_SUCCESS_MS = 350;
