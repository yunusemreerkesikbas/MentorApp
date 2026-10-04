"use client";

import type { ReactNode } from "react";

/**
 * The coach surface's signal vocabulary.
 *
 * Before this, four different KINDS of thing wore the same violet `Chip`: a risk flag on a
 * person, a count across the cohort, a novelty marker, and a status. Four meanings in one shape
 * means none of them reads as itself — worst on a roster row carrying two flags at once, where
 * the eye has nothing to separate them by.
 *
 * So form carries the distinction here, not colour:
 *
 *  - {@link SignalPill} — a finding about somebody. Hairline ring, no fill, a dot that names it.
 *  - Nothing wrong carries no mark at all: a calm student is simply "Yolunda" in the roster's
 *    groups, so it never competes with real flags two rows down.
 *
 * Hues come from `coach-theme.css`, scoped to the shell's `.coach-signals` class.
 */

/** A `--sig-*` custom property name, e.g. `"--sig-inactive"`. */
export type SignalHue = `--sig-${string}`;

function Dot({ hue, size = 6 }: { hue: SignalHue; size?: number }) {
  return (
    <span
      aria-hidden
      className="shrink-0 rounded-full"
      style={{ width: size, height: size, backgroundColor: `var(${hue})` }}
    />
  );
}

/**
 * One triage flag. `title` is the flag's reason; callers pair it with visually-hidden text so a
 * coach reading with a screen reader gets the same triage the dot gives everyone else — colour
 * carries meaning here, and the label alone does not say why.
 */
export function SignalPill({
  hue,
  title,
  children,
}: {
  hue: SignalHue;
  title?: string;
  children: ReactNode;
}) {
  return (
    <span
      title={title}
      className="inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full border py-0 pl-2 pr-2.5 text-xs font-semibold leading-none"
      style={{
        borderColor: "color-mix(in srgb, var(--color-secondary) 20%, transparent)",
        backgroundColor: "var(--color-surface)",
        color: "var(--color-body)",
      }}
    >
      <Dot hue={hue} />
      {children}
    </span>
  );
}
