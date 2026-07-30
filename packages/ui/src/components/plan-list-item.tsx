"use client";

import Check from "lucide-react/dist/esm/icons/check.mjs";
import { Chip } from "./chip.js";

export interface PlanListItemProps {
  /** Task title (user content). */
  title: string;
  /** Whether the task is done — controlled by the parent. */
  done?: boolean;
  /** Optional subject label rendered as a Chip (soft-ref to content taxonomy). */
  subject?: string | null;
  /** Toggle handler; omit for a read-only row. */
  onToggle?: () => void;
  className?: string;
}

/**
 * Plan list item — adapts the Nuton list item (335×56, node "list item") to a task row:
 * leading checkbox control + title + optional subject Chip. The whole row is the toggle
 * (≥56px tall → comfortable 44px+ touch target). State is owned by the parent (no logic here).
 */
export function PlanListItem({
  title,
  done = false,
  subject,
  onToggle,
  className,
}: PlanListItemProps) {
  const interactive = typeof onToggle === "function";

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done}
      aria-label={title}
      onClick={onToggle}
      disabled={!interactive}
      className={`flex min-h-[56px] w-full items-center gap-3 rounded-[var(--radius-card)] px-3 py-2 text-left transition-colors hover:bg-white/60 focus-visible:outline-none focus-visible:ring-2 disabled:cursor-default motion-reduce:transition-none ${className ?? ""}`}
    >
      <span
        aria-hidden
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[6px] border-2 transition-colors motion-reduce:transition-none"
        style={{
          borderColor: done
            ? "var(--color-progress)"
            : "var(--color-secondary)",
          backgroundColor: done ? "var(--color-progress)" : "transparent",
        }}
      >
        {done ? (
          <Check size={14} color="#fff" strokeWidth={3} aria-hidden />
        ) : null}
      </span>

      <span
        className="min-w-0 flex-1 truncate text-base"
        style={{
          color: done ? "var(--color-secondary)" : "var(--color-body)",
          textDecorationLine: done ? "line-through" : "none",
        }}
      >
        {title}
      </span>

      {subject ? (
        <Chip className="shrink-0 px-3 py-1 text-xs">{subject}</Chip>
      ) : null}
    </button>
  );
}
