"use client";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { DayPicker } from "react-day-picker";
import { enGB, tr } from "react-day-picker/locale";
import { forwardRef, useImperativeHandle, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import "react-day-picker/style.css";

function isoToLocalDate(iso: string): Date {
  return new Date(`${iso}T12:00:00`);
}

function localDateToIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function AnalysisPickerChevron({
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

export type AnalysisDatePickerSheetHandle = {
  getValue: () => string;
};

export type AnalysisDatePickerSheetProps = {
  defaultValue: string;
};

/** Bottom-sheet body — same month-grid picker as Plan (react-day-picker, TR/EN, Monday week start). */
export const AnalysisDatePickerSheet = forwardRef<
  AnalysisDatePickerSheetHandle,
  AnalysisDatePickerSheetProps
>(function AnalysisDatePickerSheet({ defaultValue }, ref) {
  const t = useTranslations("analysis");
  const locale = useLocale();
  const [value, setValue] = useState(defaultValue);
  const [month, setMonth] = useState(() => isoToLocalDate(defaultValue));

  const pickerLocale = locale === "en" ? enGB : tr;
  const selected = useMemo(() => isoToLocalDate(value), [value]);

  useImperativeHandle(ref, () => ({
    getValue: () => value,
  }));

  return (
    <div className="mentor-plan-day-picker-wrap">
      <button
        type="button"
        onClick={() => {
          const today = todayIso();
          setValue(today);
          setMonth(isoToLocalDate(today));
        }}
        className="mentor-plan-day-picker-today"
      >
        {t("go_today")}
      </button>

      <DayPicker
        mode="single"
        className="mentor-plan-day-picker"
        locale={pickerLocale}
        weekStartsOn={1}
        navLayout="around"
        showOutsideDays
        month={month}
        onMonthChange={setMonth}
        selected={selected}
        onSelect={(date) => {
          if (date) setValue(localDateToIso(date));
        }}
        components={{ Chevron: AnalysisPickerChevron }}
      />
    </div>
  );
});
