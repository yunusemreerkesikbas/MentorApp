"use client";

import { useId, useState } from "react";
import { CalendarDays, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { DatePickerSheet } from "@/components/date-picker-sheet";
import { PopoverMenu } from "@/components/popover-menu";
import { todayInIstanbul } from "@/lib/date-time";

const DATE_PICKER_WIDTH = 320;

export function DateField({
  label,
  value,
  min,
  disabled,
  required,
  clearLabel,
  menuClassName,
  display = "numeric",
  onChange,
}: {
  label: string;
  value: string;
  min?: string;
  disabled?: boolean;
  required?: boolean;
  /** For optional dates only: while a date is set, shows a remove button that sets `""`. */
  clearLabel?: string;
  /** Extra classes on the portaled calendar panel (e.g. a scoped theme class). */
  menuClassName?: string;
  /** How the chosen day reads: "25.09.2026" by default, "24 Eylül Perşembe" when `long`. */
  display?: "numeric" | "long";
  onChange: (value: string) => void;
}) {
  const t = useTranslations("common.date_picker");
  const locale = useLocale();
  const labelId = useId();
  const [open, setOpen] = useState(false);
  const shown = value
    ? new Intl.DateTimeFormat(
        locale,
        display === "long"
          ? { weekday: "long", day: "numeric", month: "long" }
          : { day: "2-digit", month: "2-digit", year: "numeric" },
      ).format(new Date(`${value}T12:00:00`))
    : "";

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span
        id={labelId}
        className="text-xs font-semibold"
        style={{
          color: "var(--color-secondary)",
          fontFamily: "var(--font-heading)",
        }}
      >
        {label}
      </span>
      <PopoverMenu
        align="left"
        side="bottom"
        panelRole="dialog"
        panelWidth={DATE_PICKER_WIDTH}
        overflow="visible"
        open={open}
        onOpenChange={setOpen}
        menuClassName={`w-80 p-0 ${menuClassName ?? ""}`}
        trigger={({ open: menuOpen, setOpen: setMenuOpen, menuId }) => (
          <div
            className="flex min-h-11 w-full items-center gap-2 rounded-[var(--radius-card)] border bg-[var(--color-surface-translucent)] px-3 py-2"
            style={{
              color: "var(--color-body)",
              borderColor: "var(--color-border)",
              boxShadow: "var(--shadow-card)",
              fontFamily: "var(--font-body)",
            }}
          >
            <span className="min-w-0 flex-1 truncate text-sm">{shown}</span>
            {clearLabel && value && !disabled ? (
              <button
                type="button"
                aria-label={clearLabel}
                title={clearLabel}
                onClick={() => onChange("")}
                className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-[var(--radius-card)] outline-none hover:bg-[color-mix(in_srgb,var(--color-main)_6%,transparent)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
              >
                <X className="size-4" style={{ color: "var(--color-secondary)" }} strokeWidth={2} aria-hidden />
              </button>
            ) : null}
            <button
              type="button"
              disabled={disabled}
              aria-labelledby={labelId}
              aria-haspopup="dialog"
              aria-expanded={menuOpen}
              aria-controls={menuOpen ? menuId : undefined}
              aria-required={required || undefined}
              data-iso={value}
              data-min={min}
              onClick={() => {
                if (!disabled) setMenuOpen(!menuOpen);
              }}
              className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-[var(--radius-card)] outline-none hover:bg-[color-mix(in_srgb,var(--color-main)_6%,transparent)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <CalendarDays
                className="size-5"
                style={{ color: "var(--color-secondary)" }}
                strokeWidth={2}
                aria-hidden
              />
              <span className="sr-only">{t("title")}</span>
            </button>
          </div>
        )}
      >
        <DatePickerSheet
          variant="popover"
          // An empty optional field has no month to open on; start from the earliest allowed day.
          defaultValue={value || min || todayInIstanbul()}
          min={min}
          onChange={(next) => {
            onChange(next);
            setOpen(false);
          }}
        />
      </PopoverMenu>
    </div>
  );
}
