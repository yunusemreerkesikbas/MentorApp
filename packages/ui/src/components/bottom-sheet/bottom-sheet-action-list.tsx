"use client";
import { CheckCircle2, ChevronRight, Clock, RefreshCw, Trash2 } from "lucide-react";

import type * as React from "react";
import type { BottomSheetAction, BottomSheetActionIcon } from "./types.js";

const ICONS: Record<
  BottomSheetActionIcon,
  React.ComponentType<{ size?: number; strokeWidth?: number; color?: string }>
> = {
  "check-circle": CheckCircle2,
  clock: Clock,
  refresh: RefreshCw,
  delete: Trash2,
};

export interface BottomSheetActionListProps {
  actions: BottomSheetAction[];
  onSelect: (actionId: string) => void;
}

export function BottomSheetActionList({
  actions,
  onSelect,
}: BottomSheetActionListProps) {
  return (
    <ul className="flex flex-col">
      {actions.map((action) => {
        const Icon = action.icon ? ICONS[action.icon] : null;
        const destructive = action.destructive === true;
        const showChevron = action.showChevron ?? (destructive ? false : true);
        const labelColor = destructive
          ? "var(--color-danger)"
          : "var(--color-body)";
        const iconColor = destructive
          ? "var(--color-danger)"
          : "var(--color-secondary)";

        return (
          <li key={action.id}>
            <button
              type="button"
              onClick={() => onSelect(action.id)}
              className={`flex h-14 w-full items-center justify-between border-b px-0 text-left transition-transform active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none ${destructive ? "hover:bg-[var(--color-error-container)]/30" : "hover:bg-[var(--color-surface-variant)]/30"}`}
              style={{
                borderColor:
                  "color-mix(in srgb, var(--color-main) 6%, transparent)",
              }}
            >
              <span className="flex min-w-0 flex-1 items-center gap-4">
                {Icon ? (
                  <Icon
                    size={20}
                    strokeWidth={2}
                    color={iconColor}
                    aria-hidden
                  />
                ) : (
                  <span className="w-5 shrink-0" aria-hidden />
                )}
                <span
                  className="truncate text-base"
                  style={{
                    color: labelColor,
                    fontFamily: "var(--font-body)",
                  }}
                >
                  {action.label}
                </span>
              </span>
              {showChevron ? (
                <ChevronRight
                  size={20}
                  strokeWidth={2}
                  color="var(--color-secondary)"
                  aria-hidden
                />
              ) : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
