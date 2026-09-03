"use client";

import { ChevronDown } from "lucide-react";
import { PopoverMenu, PopoverMenuItem } from "@/components/popover-menu";

export interface HistoryFilterOption {
  value: string;
  label: string;
}

export interface HistoryFilterSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly HistoryFilterOption[];
  className?: string;
  testId?: string;
}

/**
 * Standard dropdown filter for HistorySidePanel rails and drawers.
 * Replaces native selects with the app's PopoverMenu design system.
 */
export function HistoryFilterSelect({
  label,
  value,
  onChange,
  options,
  className,
  testId,
}: HistoryFilterSelectProps) {
  const selectedOption = options.find((opt) => opt.value === value);

  return (
    <div className={`relative min-w-0 flex-1 ${className ?? ""}`} data-testid={testId}>
      <PopoverMenu
        align="left"
        matchTriggerWidth
        panelRole="listbox"
        menuClassName="min-w-[8rem] max-h-60 overflow-y-auto mentor-scrollarea"
        trigger={({ open, setOpen, menuId }) => (
          <button
            type="button"
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-controls={open ? menuId : undefined}
            aria-label={label}
            onClick={() => setOpen(!open)}
            className="flex min-h-8 w-full cursor-pointer items-center justify-between gap-1.5 rounded-[var(--radius-card)] border px-2.5 py-1.5 text-left text-xs font-bold transition-colors hover:bg-[color-mix(in_srgb,var(--color-main)_4%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none"
            style={{
              backgroundColor: "var(--color-surface)",
              color: "var(--color-main)",
              borderColor: "color-mix(in srgb, var(--color-main) 12%, transparent)",
              boxShadow: "var(--shadow-card)",
              fontFamily: "var(--font-body)",
            }}
          >
            <span className="min-w-0 flex-1 truncate">
              {selectedOption?.label ?? label}
            </span>
            <ChevronDown
              className={`size-3.5 shrink-0 transition-transform duration-200 motion-reduce:transition-none ${
                open ? "rotate-180" : ""
              }`}
              style={{ color: "var(--color-secondary)" }}
              strokeWidth={2.25}
              aria-hidden
            />
          </button>
        )}
      >
        {options.map((option) => {
          const isSelected = option.value === value;
          return (
            <PopoverMenuItem
              key={option.value}
              role="option"
              selected={isSelected}
              onClick={() => onChange(option.value)}
            >
              <span className="text-xs font-medium">{option.label}</span>
            </PopoverMenuItem>
          );
        })}
      </PopoverMenu>
    </div>
  );
}
