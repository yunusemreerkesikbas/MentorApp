"use client";

import type * as React from "react";

export type ChoiceChipShape = "default" | "pill";

export interface ChoiceChipProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  /** Whether this option is the current value in a single-select group. */
  selected?: boolean;
  /**
   * `pill` = fully rounded (colour swatches, subject tags).
   * `default` = DESIGN.md 10px radius (material / rectangular choices).
   */
  shape?: ChoiceChipShape;
}

/**
 * Selectable chip (DESIGN.md §6 tag language + §2.4 focus). Distinct from `Chip`,
 * which is a static violet badge. Selected = accent-soft well + accent border;
 * unselected uses a main-tinted hairline so the rim stays visible on light
 * `--color-border` (white).
 */
export function ChoiceChip({
  children,
  selected = false,
  shape = "default",
  className,
  type = "button",
  disabled,
  ...rest
}: ChoiceChipProps) {
  const radiusClass =
    shape === "pill" ? "rounded-full" : "rounded-[var(--radius-card)]";

  return (
    <button
      {...rest}
      type={type}
      disabled={disabled}
      aria-pressed={selected}
      className={`inline-flex min-h-11 cursor-pointer items-center justify-center border px-3 text-sm font-semibold outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none ${radiusClass} ${className ?? ""}`}
      style={{
        fontFamily: "var(--font-body)",
        color: "var(--color-main)",
        backgroundColor: selected
          ? "var(--color-accent-soft)"
          : "var(--color-surface)",
        borderColor: selected
          ? "var(--color-accent)"
          : "color-mix(in srgb, var(--color-main) 12%, transparent)",
      }}
    >
      {children}
    </button>
  );
}
