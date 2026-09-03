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
  variant?: "default" | "liquid";
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
  variant = "default",
}: HistoryFilterSelectProps) {
  const selectedOption = options.find((opt) => opt.value === value);
  const isLiquid = variant === "liquid";

  return (
    <div className={`relative min-w-0 flex-1 ${className ?? ""}`} data-testid={testId}>
      <PopoverMenu
        align="left"
        matchTriggerWidth
        panelRole="listbox"
        menuClassName={
          isLiquid
            ? "min-w-[8.5rem] max-h-60 overflow-y-auto mentor-scrollarea session-liquid-card !bg-[#1c1917]/90 !backdrop-blur-2xl !border-white/20 shadow-2xl p-1"
            : "min-w-[8rem] max-h-60 overflow-y-auto mentor-scrollarea"
        }
        trigger={({ open, setOpen, menuId }) => (
          <button
            type="button"
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-controls={open ? menuId : undefined}
            aria-label={label}
            onClick={() => setOpen(!open)}
            className={[
              "flex min-h-8 w-full cursor-pointer items-center justify-between gap-1.5 border px-2.5 py-1.5 text-left text-xs font-semibold transition-all motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]",
              isLiquid
                ? "rounded-full session-liquid-pill hover:border-white/40"
                : "rounded-[var(--radius-card)] hover:bg-[color-mix(in_srgb,var(--color-main)_4%,transparent)]",
            ].join(" ")}
            style={
              isLiquid
                ? {
                    fontFamily: "var(--font-body)",
                    color: "#ffffff",
                  }
                : {
                    backgroundColor: "var(--color-surface)",
                    color: "var(--color-main)",
                    borderColor: "color-mix(in srgb, var(--color-main) 12%, transparent)",
                    boxShadow: "var(--shadow-card)",
                    fontFamily: "var(--font-body)",
                  }
            }
          >
            <span className="min-w-0 flex-1 truncate">
              {selectedOption?.label ?? label}
            </span>
            <ChevronDown
              className={`size-3.5 shrink-0 transition-transform duration-200 motion-reduce:transition-none ${
                open ? "rotate-180" : ""
              }`}
              style={{
                color: isLiquid ? "rgba(255, 255, 255, 0.8)" : "var(--color-secondary)",
              }}
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
              className={
                isLiquid
                  ? "rounded-lg text-xs font-medium text-white/85 hover:text-white"
                  : ""
              }
            >
              <span className="text-xs font-medium">{option.label}</span>
            </PopoverMenuItem>
          );
        })}
      </PopoverMenu>
    </div>
  );
}
