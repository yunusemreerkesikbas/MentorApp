"use client";

import { DayPicker } from "react-day-picker";
import { enGB, tr } from "react-day-picker/locale";
import { useEffect, useMemo, useState } from "react";
import { useLocale } from "next-intl";
import ChevronLeft from "lucide-react/dist/esm/icons/chevron-left.mjs";
import ChevronRight from "lucide-react/dist/esm/icons/chevron-right.mjs";
import "react-day-picker/style.css";
import { Card } from "@mentor/ui";
import { listPlanTaskCalendarDates } from "@/lib/plan-tasks";
import { monthIsoBounds, todayIso, weekDates } from "./plan-utils";

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
      size={18}
      strokeWidth={2}
      aria-hidden
      style={{ color: "var(--color-main)", opacity: disabled ? 0.4 : 1 }}
    />
  );
}

export function PlanWeekMiniCalendar({
  selectedDate,
  weekStartDate,
  onDateChange,
}: {
  selectedDate: string;
  weekStartDate: string;
  onDateChange: (iso: string) => void;
}) {
  const locale = useLocale();
  const [month, setMonth] = useState(() => isoToLocalDate(selectedDate));
  const [plannedDates, setPlannedDates] = useState<Set<string>>(new Set());
  const pickerLocale = locale === "en" ? enGB : tr;
  const selected = useMemo(() => isoToLocalDate(selectedDate), [selectedDate]);
  const weekDays = useMemo(() => weekDates(weekStartDate).map(isoToLocalDate), [weekStartDate]);
  const plannedDateObjects = useMemo(
    () => [...plannedDates].map(isoToLocalDate),
    [plannedDates],
  );
  const monthYear = month.getFullYear();
  const monthIndex = month.getMonth();

  // The toolbar owns "Bugün" and the ‹ › stepping, so the picker has to follow the date it is
  // told about — otherwise jumping to today leaves the mini calendar on the month it was browsing.
  // Adjusted during render (React's "changing state when a prop changes" pattern) rather than in
  // an effect: browsing months locally must still win until `selectedDate` leaves the shown month.
  const [shownForDate, setShownForDate] = useState(selectedDate);
  if (selectedDate.slice(0, 7) !== shownForDate.slice(0, 7)) {
    setShownForDate(selectedDate);
    setMonth(isoToLocalDate(`${selectedDate.slice(0, 7)}-01`));
  }

  useEffect(() => {
    let active = true;
    const { from, to } = monthIsoBounds(monthYear, monthIndex);
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
  }, [monthYear, monthIndex]);

  return (
    <Card className="overflow-hidden p-4">
      <div className="mentor-plan-day-picker-wrap mentor-plan-week-mini-calendar w-full max-w-none">
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
            if (date) onDateChange(localDateToIso(date));
          }}
          modifiers={{
            has_plan: plannedDateObjects,
            week_range: weekDays,
            today: [isoToLocalDate(todayIso())],
          }}
          modifiersClassNames={{
            has_plan: "mentor-plan-day",
            week_range: "mentor-plan-week-range",
            today: "mentor-plan-day-today",
          }}
          components={{ Chevron: PlanPickerChevron }}
        />
      </div>
    </Card>
  );
}
