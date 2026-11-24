/**
 * Calendar event colors are DERIVED from the task's subject — no color column, no picker.
 * The same subject always lands on the same swatch, so a month grid reads as subject grouping
 * instead of decoration. Tasks without a subject get the neutral swatch.
 *
 * The hash and the swatch order live in `@mentor/core` (shared with mobile). This file paints
 * them as CSS: every swatch is an existing `@mentor/ui` accent token (DESIGN.md §2.3) — no new hex.
 * Chips render a tinted background + a solid left bar and keep `--color-main` text, so body copy
 * stays ≥4.5:1 and color is never the only carrier of meaning (the subject name is always shown).
 */

import {
  PLAN_EVENT_NEUTRAL_SWATCH,
  PLAN_EVENT_SWATCHES,
  planEventSwatch,
  type PlanEventSwatch,
  type PlanEventSwatchToken,
} from "@mentor/core";

export interface PlanEventColor {
  /** Chip / block background (tinted, low alpha). */
  bg: string;
  /** 3px leading bar + dot — the saturated accent. */
  bar: string;
}

const CSS_TOKEN: Record<PlanEventSwatchToken, string> = {
  progress: "--color-progress",
  chip: "--color-chip",
  thumbViolet: "--color-thumb-violet",
  success: "--color-success",
  star: "--color-star",
  secondary: "--color-secondary",
};

function toCss({ token, tint }: PlanEventSwatch): PlanEventColor {
  const cssVar = CSS_TOKEN[token];
  return {
    bar: `var(${cssVar})`,
    bg: `color-mix(in srgb, var(${cssVar}) ${tint}%, transparent)`,
  };
}

/** Same order and instances as the core swatches, so a bucket always returns the same object. */
const PALETTE: PlanEventColor[] = PLAN_EVENT_SWATCHES.map(toCss);
const NEUTRAL = toCss(PLAN_EVENT_NEUTRAL_SWATCH);

export function planEventColor(subject: string | null | undefined): PlanEventColor {
  const swatch = planEventSwatch(subject);
  return swatch === PLAN_EVENT_NEUTRAL_SWATCH ? NEUTRAL : PALETTE[PLAN_EVENT_SWATCHES.indexOf(swatch)]!;
}

export { NEUTRAL as planEventNeutralColor, PALETTE as planEventPalette };
