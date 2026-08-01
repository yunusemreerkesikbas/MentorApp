"use client";

import { useId } from "react";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down.mjs";
import { PopoverMenu, PopoverMenuItem } from "@/components/popover-menu";

export interface MenuSelectOption {
  value: string;
  label: string;
}

export interface MenuSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: readonly MenuSelectOption[];
  disabled?: boolean;
  id?: string;
  className?: string;
  /** Associates the trigger with an external visible label (`htmlFor` on that label). */
  "aria-labelledby"?: string;
  "aria-label"?: string;
}

const fieldStyle = {
  borderColor: "var(--color-border, #e2e2e2)",
  color: "var(--color-body)",
  backgroundColor: "var(--color-surface, #fff)",
} as const;

/**
 * Single-select field that opens the shared PopoverMenu panel instead of a native `<select>`.
 * Trigger matches form field height (44px); options use the PlanTaskMenu dropdown chrome.
 */
export function MenuSelect({
  value,
  onChange,
  options,
  disabled,
  id,
  className,
  "aria-labelledby": ariaLabelledBy,
  "aria-label": ariaLabel,
}: MenuSelectProps) {
  const reactId = useId();
  const triggerId = id ?? `menu-select-${reactId}`;
  const selected = options.find((option) => option.value === value);

  return (
    <div className={className}>
      <PopoverMenu
        align="left"
        matchTriggerWidth
        panelRole="listbox"
        trigger={({ open, setOpen, menuId }) => (
          <button
            type="button"
            id={triggerId}
            disabled={disabled}
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-controls={open ? menuId : undefined}
            aria-labelledby={ariaLabelledBy}
            aria-label={ariaLabel}
            onClick={() => setOpen(!open)}
            className="flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-[var(--radius-card)] border px-3 text-left text-base transition-colors hover:bg-black/[0.02] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none"
            style={fieldStyle}
          >
            <span className="min-w-0 flex-1 truncate">
              {selected?.label ?? ""}
            </span>
            <ChevronDown
              size={18}
              strokeWidth={2}
              aria-hidden
              className={[
                "shrink-0 transition-transform duration-200 motion-reduce:transition-none",
                open ? "rotate-180" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              style={{ color: "var(--color-secondary)" }}
            />
          </button>
        )}
      >
        {options.map((option) => (
          <PopoverMenuItem
            key={option.value}
            role="option"
            selected={option.value === value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </PopoverMenuItem>
        ))}
      </PopoverMenu>
    </div>
  );
}
