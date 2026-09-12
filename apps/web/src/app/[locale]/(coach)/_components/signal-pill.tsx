"use client";

import { Check } from "lucide-react";
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
 *  - {@link SignalCount} — a measurement. Deliberately NOT a pill: the pill shape is reserved
 *    for "this is a flag on a person", and a count is not something you can act on.
 *  - {@link NewBadge} — chrome on one line of the brief. At tag weight it out-shouted the
 *    student's name beside it.
 *  - {@link CalmLabel} — not a pill at all. "Nothing is wrong" must not carry the visual weight
 *    of a finding, or it competes with real flags two rows down.
 *
 * Hues come from `coach-signals.css`, scoped to the shell's `.coach-signals` class.
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

/** The cohort breakdown: how many students carry this signal. A number, not a badge. */
export function SignalCount({
  hue,
  count,
  children,
}: {
  hue: SignalHue;
  count: number;
  children: ReactNode;
}) {
  return (
    <span
      className="inline-flex items-center gap-[7px] text-[13px]"
      style={{ color: "var(--color-body)" }}
    >
      <Dot hue={hue} />
      {/* Count and label are ONE text run. As two flex items the gap would separate them
          visually but leave the accessible name as "1Sessiz" — the space has to be real. */}
      <span>
        <b className="font-bold tabular-nums" style={{ color: "var(--color-main)" }}>
          {count}
        </b>{" "}
        {children}
      </span>
    </span>
  );
}

/**
 * "Yeni" on a brief line. The accent rather than the flag vocabulary, because it is not a finding
 * about the student — it says the brief has news since the last one.
 */
export function NewBadge({ children }: { children: ReactNode }) {
  return (
    <span
      className="inline-flex h-[18px] items-center rounded-full px-[7px] text-[11px] font-bold leading-none tracking-[0.01em]"
      style={{
        backgroundColor: "color-mix(in srgb, var(--color-progress) 16%, transparent)",
        color: "var(--color-focus-ring)",
      }}
    >
      {children}
    </span>
  );
}

/** A student with nothing wrong. Quiet text, so "nothing to do" reads as nothing to do. */
export function CalmLabel({ children }: { children: ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-medium"
      style={{ color: "var(--color-secondary)" }}
    >
      <Check aria-hidden size={14} strokeWidth={2.25} />
      {children}
    </span>
  );
}
