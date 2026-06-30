"use client";

import { DayPicker } from "react-day-picker";
import { enGB, tr } from "react-day-picker/locale";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from "react";
import { useLocale, useTranslations } from "next-intl";
import ChevronLeft from "lucide-react/dist/esm/icons/chevron-left.mjs";
import ChevronRight from "lucide-react/dist/esm/icons/chevron-right.mjs";
import "react-day-picker/style.css";
import { listPlanTaskCalendarDates } from "@/lib/plan-tasks";
import { monthIsoBounds, todayIso } from "./plan-utils";

function isoToLocalDate(iso: string): Date {
  return new Date(`${iso}T12:00:00`);
}

function localDateToIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function PlanPickerChevron({
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

export type PlanDatePickerSheetHandle = {
  getValue: () => string;
};

export type PlanDatePickerSheetProps = {
  defaultValue: string;
  /** Already-loaded dates with tasks — shown until the visible month fetch completes. */
  seedPlannedDates?: string[];
};

/** Bottom-sheet body — month grid via react-day-picker (TR/EN locale, Monday week start). */
export const PlanDatePickerSheet = forwardRef<
  PlanDatePickerSheetHandle,
  PlanDatePickerSheetProps
>(function PlanDatePickerSheet({ defaultValue, seedPlannedDates = [] }, ref) {
  const t = useTranslations("plan");
  const locale = useLocale();
  const [value, setValue] = useState(defaultValue);
  const [month, setMonth] = useState(() => isoToLocalDate(defaultValue));
  const [plannedDates, setPlannedDates] = useState<Set<string>>(
    () => new Set(seedPlannedDates),
  );

  const pickerLocale = locale === "en" ? enGB : tr;
  const selected = useMemo(() => isoToLocalDate(value), [value]);
  const plannedDateObjects = useMemo(
    () => [...plannedDates].map(isoToLocalDate),
    [plannedDates],
  );

  const monthKey = `${month.getFullYear()}-${month.getMonth()}`;

  useEffect(() => {
    setPlannedDates((prev) => new Set([...prev, ...seedPlannedDates]));
  }, [seedPlannedDates]);

  useEffect(() => {
    let active = true;
    const { from, to } = monthIsoBounds(month.getFullYear(), month.getMonth());

    listPlanTaskCalendarDates(from, to)
      .then((dates) => {
        if (!active) return;
        setPlannedDates(new Set(dates));
      })
      .catch(() => {
        if (!active) return;
      });

    return () => {
      active = false;
    };
  }, [monthKey]);

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
        modifiers={{ has_plan: plannedDateObjects }}
        modifiersClassNames={{ has_plan: "mentor-plan-day" }}
        components={{ Chevron: PlanPickerChevron }}
      />
    </div>
  );
});
