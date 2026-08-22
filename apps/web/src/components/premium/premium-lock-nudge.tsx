"use client";

import { ArrowRight, Crown } from "lucide-react";

export function PremiumLockNudge({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group inline-flex min-h-11 max-w-full items-center gap-2 text-left text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
      style={{ color: "var(--color-main)" }}
    >
      <Crown
        size={16}
        strokeWidth={1.75}
        className="shrink-0"
        style={{ color: "var(--color-star)" }}
        aria-hidden
      />
      <span className="min-w-0 underline decoration-[var(--color-secondary)] underline-offset-2">
        {label}
      </span>
      <ArrowRight
        size={16}
        strokeWidth={1.75}
        className="shrink-0 transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
        style={{ color: "var(--color-secondary)" }}
        aria-hidden
      />
    </button>
  );
}
