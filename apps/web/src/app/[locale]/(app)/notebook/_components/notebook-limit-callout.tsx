"use client";

import { Sparkles } from "lucide-react";

export function NotebookQuotaBadge({
  label,
  full = false,
  onClick,
}: {
  label: string;
  full?: boolean;
  onClick?: () => void;
}) {
  if (full && onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="inline-flex cursor-pointer items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums outline-none transition-transform duration-150 hover:scale-[1.02] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none"
        style={{
          backgroundColor: "var(--play-selected)",
          color: "var(--play-selected-ink)",
        }}
      >
        <Sparkles aria-hidden size={12} />
        {label}
      </button>
    );
  }

  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums"
      style={{
        backgroundColor: full
          ? "var(--play-selected)"
          : "var(--color-surface-container)",
        color: full ? "var(--play-selected-ink)" : "var(--color-secondary)",
      }}
    >
      {label}
    </span>
  );
}
