"use client";

import type * as React from "react";

export interface ChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode;
  /** "sm" for a quieter inline badge (e.g. an AI-content marker); default matches the Figma spec. */
  size?: "sm" | "md";
}

/**
 * Tag/chip (DESIGN.md §6, node 141:1736): violet 30% fill, radius 10, Plus Jakarta Sans Bold 14.
 * A hairline border (chip-text @ 18%) adds definition against light card surfaces.
 */
export function Chip({ children, className, size = "md", ...rest }: ChipProps) {
  const sizeClass = size === "sm" ? "px-2.5 py-1 text-xs" : "px-4 py-2 text-sm";
  return (
    <span
      {...rest}
      className={`inline-block w-fit rounded-[var(--radius-card)] border font-bold capitalize ${sizeClass} ${className ?? ""}`}
      style={{
        backgroundColor:
          "color-mix(in srgb, var(--color-chip) 30%, transparent)",
        borderColor: "color-mix(in srgb, var(--color-chip-text) 18%, transparent)",
        color: "var(--color-chip-text)",
        fontFamily: "var(--font-body)",
      }}
    >
      {children}
    </span>
  );
}
