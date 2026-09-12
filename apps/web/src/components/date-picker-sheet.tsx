"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";
import { enGB, tr } from "react-day-picker/locale";
import {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useState,
} from "react";
import { useLocale, useTranslations } from "next-intl";
import { todayInIstanbul } from "@/lib/date-time";
import "react-day-picker/style.css";

export function isoToLocalDate(iso: string): Date {
  return new Date(`${iso}T12:00:00`);
}

export function localDateToIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export type DatePickerSheetHandle = {
  getValue: () => string;
};

export type DatePickerSheetProps = {
  defaultValue: string;
  min?: string;
  markedDates?: readonly string[];
  onMonthChange?: (year: number, monthIndex: number) => void;
  onChange?: (value: string) => void;
  variant?: "sheet" | "popover";
};

function PickerChevron({
  orientation,
  disabled,
}: {
  orientation?: "up" | "down" | "left" | "right";
  disabled?: boolean;
}) {
  if (orientation === "up" || orientation === "down") {
    return <span className="sr-only" aria-hidden />;
  }
  const Icon = orientation === "left" ? ChevronLeft : ChevronRight;
  return (
    <Icon
      size={20}
      strokeWidth={2}
      aria-hidden
      style={{
        color: "var(--color-main)",
        opacity: disabled ? 0.4 : 1,
      }}
    />
  );
}

/** Shared month grid for date sheets (plan, analysis, coach forms). */
export const DatePickerSheet = forwardRef<DatePickerSheetHandle, DatePickerSheetProps>(
  function DatePickerSheet(
    { defaultValue, min, markedDates = [], onMonthChange, onChange, variant = "sheet" },
    ref,
  ) {
    const t = useTranslations("common.date_picker");
    const locale = useLocale();
    const [value, setValue] = useState(defaultValue);
    const [month, setMonth] = useState(() => isoToLocalDate(defaultValue));
    const pickerLocale = locale === "en" ? enGB : tr;
    const selected = useMemo(() => isoToLocalDate(value), [value]);
    const marked = useMemo(
      () => markedDates.map(isoToLocalDate),
      [markedDates],
    );
    const minDate = min ? isoToLocalDate(min) : undefined;

    function pick(next: string) {
      setValue(next);
      onChange?.(next);
    }

    useImperativeHandle(ref, () => ({
      getValue: () => value,
    }));

    return (
      <div
        className={
          variant === "popover"
            ? "mentor-plan-day-picker-wrap mentor-plan-day-picker-popover"
            : "mentor-plan-day-picker-wrap"
        }
      >
        <button
          type="button"
          onClick={() => {
            const today = todayInIstanbul();
            if (min && today < min) return;
            pick(today);
            setMonth(isoToLocalDate(today));
          }}
          className="mentor-plan-day-picker-today"
        >
          {t("today")}
        </button>

        <DayPicker
          mode="single"
          className="mentor-plan-day-picker"
          locale={pickerLocale}
          weekStartsOn={1}
          navLayout="around"
          showOutsideDays
          month={month}
          onMonthChange={(next) => {
            setMonth(next);
            onMonthChange?.(next.getFullYear(), next.getMonth());
          }}
          selected={selected}
          onSelect={(date) => {
            if (date) pick(localDateToIso(date));
          }}
          disabled={minDate ? { before: minDate } : undefined}
          modifiers={{ has_plan: marked }}
          modifiersClassNames={{ has_plan: "mentor-plan-day" }}
          components={{ Chevron: PickerChevron }}
        />
      </div>
    );
  },
);
