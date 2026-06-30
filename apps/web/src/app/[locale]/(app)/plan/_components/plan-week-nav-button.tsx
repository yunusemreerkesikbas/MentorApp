"use client";

import type { ReactNode } from "react";

/** 44×44 week/day nav control — shared across Hafta surfaces. */
export function PlanWeekNavButton({
  label,
  onClick,
  compact,
  children,
}: {
  label: string;
  onClick: () => void;
  compact?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex shrink-0 cursor-pointer items-center justify-center rounded-[var(--radius-card)] transition-colors hover:bg-white/60 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none ${compact ? "min-h-10 min-w-10" : "min-h-11 min-w-11"}`}
      style={{ color: "var(--color-main)" }}
      aria-label={label}
    >
      {children}
    </button>
  );
}
