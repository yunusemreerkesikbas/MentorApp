"use client";

import type * as React from "react";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  /** Solid surface instead of the default translucent surface. */
  solid?: boolean;
}

/**
 * Card (DESIGN.md §2.2/§6): translucent surface + 1px border by default,
 * radius 10, the single blue-tinted shadow token. Follows `html.dark`.
 */
export function Card({ children, solid, className, ...rest }: CardProps) {
  return (
    <div
      {...rest}
      className={`rounded-[var(--radius-card)] border border-[var(--color-border)] p-6 ${solid ? "bg-[var(--color-surface)]" : "bg-[var(--color-surface-translucent)]"} ${className ?? ""}`}
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      {children}
    </div>
  );
}
