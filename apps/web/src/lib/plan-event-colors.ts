/**
 * Calendar event colors are DERIVED from the task's subject — no color column, no picker.
 * The same subject always lands on the same swatch, so a month grid reads as subject grouping
 * instead of decoration. Tasks without a subject get the neutral swatch.
 *
 * Every swatch is an existing `@mentor/ui` accent token (DESIGN.md §2.3) — no new hex here.
 * Chips render a tinted background + a solid left bar and keep `--color-main` text, so body copy
 * stays ≥4.5:1 and color is never the only carrier of meaning (the subject name is always shown).
 */

export interface PlanEventColor {
  /** Chip / block background (tinted, low alpha). */
  bg: string;
  /** 3px leading bar + dot — the saturated accent. */
  bar: string;
}

function swatch(token: string, tintPercent: number): PlanEventColor {
  return {
    bar: `var(${token})`,
    bg: `color-mix(in srgb, var(${token}) ${tintPercent}%, transparent)`,
  };
}

/**
 * Fixed order — the index is the hash bucket, so reordering re-colors everyone's calendar.
 *
 * A cool blue→violet→orchid ramp plus one warm and one green. Coral (`--color-streak`) is
 * deliberately absent: at chip size it reads as an error state, and DESIGN.md reserves that hue
 * for the streak flame. Tint percentages are per-swatch so the fills land at a similar lightness.
 */
const PALETTE: PlanEventColor[] = [
  swatch("--color-progress", 18), // blue
  swatch("--color-chip", 24), // violet
  swatch("--color-thumb-violet", 26), // orchid
  swatch("--color-success", 13), // green
  swatch("--color-star", 26), // amber
];

const NEUTRAL = swatch("--color-secondary", 12);

/**
 * FNV-1a, stable across sessions and devices. Not the classic `hash * 31 + c` fold: 31 ≡ 1 (mod 5),
 * so that one collapses to `sum(charCodes) % 5` and buckets most KPSS subjects onto one swatch.
 */
function hashSubject(subject: string): number {
  let hash = 2166136261;
  for (let i = 0; i < subject.length; i++) {
    hash ^= subject.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash ^ (hash >>> 16)) >>> 0;
}

export function planEventColor(subject: string | null | undefined): PlanEventColor {
  const key = subject?.trim();
  if (!key) return NEUTRAL;
  return PALETTE[hashSubject(key) % PALETTE.length]!;
}

export { NEUTRAL as planEventNeutralColor, PALETTE as planEventPalette };
