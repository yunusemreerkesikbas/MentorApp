"use client";

import type { HTMLAttributes, ReactNode } from "react";

export interface ChipProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
}

/** Tag/chip (DESIGN.md §6, node 141:1736): violet 30% fill, radius 10, Nunito Sans Bold 14. */
export function Chip({ children, className, ...rest }: ChipProps) {
  return (
    <span
      {...rest}
      className={`inline-block w-fit rounded-[var(--radius-card)] px-4 py-2 text-sm font-bold capitalize ${className ?? ""}`}
      style={{
        backgroundColor: "color-mix(in srgb, var(--color-chip) 30%, transparent)",
        color: "var(--color-chip-text)",
        fontFamily: "var(--font-body)",
      }}
    >
      {children}
    </span>
  );
}
