"use client";

import { Check } from "lucide-react";
import type { ReactNode } from "react";

export type PlayWell = "blue" | "peri" | "violet" | "coral" | "pink";

const WELL_BG: Record<PlayWell, string> = {
  blue: "bg-[var(--play-well-blue)]",
  peri: "bg-[var(--play-well-peri)]",
  violet: "bg-[var(--play-well-violet)]",
  coral: "bg-[var(--play-well-coral)]",
  pink: "bg-[var(--play-well-pink)]",
};

/** Card press: 2px down while the 4px bottom edge shrinks to 2px. */
const CARD =
  "rounded-[var(--play-radius)] border-2 border-b-4 outline-none transition-[transform,border-color,background-color] duration-150 ease-out focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] active:translate-y-0.5 active:border-b-2 disabled:cursor-not-allowed disabled:opacity-50 disabled:active:translate-y-0 disabled:active:border-b-4 motion-reduce:transition-none";

function cardLook(selected: boolean) {
  return selected
    ? "border-[var(--play-cta)] bg-[var(--play-selected)]"
    : "border-[var(--play-line)] bg-[var(--color-surface)]";
}

function labelInk(selected: boolean) {
  return selected ? "text-[var(--play-selected-ink)]" : "text-[var(--color-main)]";
}

export function PlayIconWell({ well, className = "size-11", children }: { well: PlayWell; className?: string; children: ReactNode }) {
  return (
    <span aria-hidden className={`flex shrink-0 items-center justify-center rounded-full text-[var(--color-main)] ${WELL_BG[well]} ${className}`}>
      {children}
    </span>
  );
}

type ChoiceProps = {
  label: string;
  sub?: string;
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
};

/** Full-width radio row: optional icon well, label + sub, check mark. Lives in a `radiogroup`. */
export function PlayOptionRow({ label, sub, lead, selected, disabled, onSelect }: ChoiceProps & { lead?: ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className={`flex min-h-[4.5rem] w-full items-center gap-3 px-4 py-3 text-left ${CARD} ${cardLook(selected)}`}
    >
      {lead}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className={`text-base font-bold leading-snug ${labelInk(selected)}`}>{label}</span>
        {sub ? <span className="text-sm font-medium leading-normal text-[var(--color-secondary)]">{sub}</span> : null}
      </span>
      {selected ? (
        <span aria-hidden className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--play-cta)] text-[var(--play-cta-ink)]">
          <Check size={16} strokeWidth={3} />
        </span>
      ) : (
        <span aria-hidden className="size-6 shrink-0 rounded-full border-2 border-[var(--play-line)]" />
      )}
    </button>
  );
}

/** Grid radio card: art on top, label (+ sub) below, optional pill badge on the top edge. */
export function PlayGridCard({
  label,
  sub,
  art,
  badge,
  compact = false,
  selected,
  disabled,
  onSelect,
}: ChoiceProps & { art: ReactNode; badge?: string; compact?: boolean }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className={`relative flex h-full flex-col items-center justify-center gap-1.5 text-center ${compact ? "min-h-[7.25rem] px-1.5 py-2.5 lg:min-h-[10.25rem] lg:px-2 lg:py-4" : "min-h-28 px-2 py-3"} ${CARD} ${cardLook(selected)}`}
    >
      {badge ? (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[var(--play-cta)] px-3 py-1 text-xs font-extrabold text-[var(--play-cta-ink)]">
          {badge}
        </span>
      ) : null}
      {art}
      <span className={`font-bold leading-tight ${compact ? "text-sm lg:text-base" : "text-base"} ${labelInk(selected)}`}>{label}</span>
      {sub ? <span className="text-sm font-medium leading-snug text-[var(--color-secondary)]">{sub}</span> : null}
    </button>
  );
}
