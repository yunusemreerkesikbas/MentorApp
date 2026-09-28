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
        // Bare line icon, no well (overlay kit): colour only where it means something.
        const tone = destructive ? "var(--color-danger)" : "var(--color-main)";

        return (
          <li key={action.id}>
            <button
              type="button"
              onClick={() => onSelect(action.id)}
              className="flex min-h-[60px] w-full cursor-pointer items-center gap-3 border-t border-[var(--play-line)] text-left outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-focus-ring)] active:opacity-70 motion-reduce:transition-none"
            >
              {Icon ? (
                <Icon size={22} strokeWidth={1.75} color={tone} aria-hidden />
              ) : (
                <span className="w-[22px] shrink-0" aria-hidden />
              )}
              <span
                className="min-w-0 flex-1 truncate text-body-sm font-extrabold"
                style={{ color: tone }}
              >
                {action.label}
              </span>
              {showChevron ? (
                <ChevronRight
                  size={20}
                  strokeWidth={1.75}
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
