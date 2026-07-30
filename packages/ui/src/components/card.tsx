"use client";

import type * as React from "react";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  /** Solid white instead of the default translucent surface. */
  solid?: boolean;
}

/**
 * Card (DESIGN.md §2.2/§6): translucent white (50%) + 1px white border by default,
 * radius 10, the single blue-tinted shadow token.
 */
export function Card({ children, solid, className, ...rest }: CardProps) {
  return (
    <div
      {...rest}
      className={`rounded-[var(--radius-card)] border border-white p-6 ${solid ? "bg-white" : "bg-white/50"} ${className ?? ""}`}
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      {children}
    </div>
  );
}
