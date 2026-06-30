"use client";

import { DayPicker } from "react-day-picker";
import { enGB, tr } from "react-day-picker/locale";
import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import ChevronLeft from "lucide-react/dist/esm/icons/chevron-left.mjs";
import ChevronRight from "lucide-react/dist/esm/icons/chevron-right.mjs";
import "react-day-picker/style.css";
import type { PlanTaskDto } from "@mentor/types";
import { Card, ProgressBar } from "@mentor/ui";
import { listPlanTaskCalendarDates } from "@/lib/plan-tasks";
import { PlanWeekNavButton } from "./plan-week-nav-button";
import {
  formatWeekRangeLabel,
  monthIsoBounds,
  shiftDate,
  taskStats,
  todayIso,
  weekCompletionStats,
  weekDates,
} from "./plan-utils";

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
  const t = useTranslations("plan");
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
  const monthKey = `${month.getFullYear()}-${month.getMonth()}`;

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
      <button
        type="button"
        onClick={() => {
          const today = todayIso();
          onDateChange(today);
          setMonth(isoToLocalDate(today));
        }}
        className="mentor-plan-day-picker-today mentor-plan-week-mini-today w-full"
      >
        {t("go_today")}
      </button>
    </Card>
  );
}

const WEEKDAY_KEYS = [
  "week_mon",
  "week_tue",
  "week_wed",
  "week_thu",
  "week_fri",
  "week_sat",
  "week_sun",
] as const;

export function PlanWeekSummaryList({
  weekStartDate,
  selectedDate,
  weekTasks,
  onDateChange,
  onWeekChange,
}: {
  weekStartDate: string;
  selectedDate: string;
  weekTasks: Record<string, PlanTaskDto[]>;
  onDateChange: (iso: string) => void;
  onWeekChange: (weekStart: string) => void;
}) {
  const t = useTranslations("plan");
  const tPanel = useTranslations("panel");
  const locale = useLocale();
  const days = weekDates(weekStartDate);
  const weekEnd = days[6]!;
  const weekProgress = weekCompletionStats(weekTasks, weekStartDate);

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center gap-1">
        <PlanWeekNavButton
          label={t("prev_week_aria")}
          compact
          onClick={() => onWeekChange(shiftDate(weekStartDate, -7))}
        >
          <ChevronLeft size={18} strokeWidth={2} aria-hidden />
        </PlanWeekNavButton>
        <h3
          className="min-w-0 flex-1 px-1 text-center text-sm font-bold leading-snug"
          style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
        >
          {formatWeekRangeLabel(weekStartDate, weekEnd, locale)}
        </h3>
        <PlanWeekNavButton
          label={t("next_week_aria")}
          compact
          onClick={() => onWeekChange(shiftDate(weekStartDate, 7))}
        >
          <ChevronRight size={18} strokeWidth={2} aria-hidden />
        </PlanWeekNavButton>
      </div>
      <ul className="flex flex-col gap-0.5">
        {days.map((iso, index) => {
          const stats = taskStats(weekTasks[iso] ?? []);
          const selected = iso === selectedDate;
          return (
            <li key={iso}>
              <button
                type="button"
                onClick={() => onDateChange(iso)}
                className="flex w-full cursor-pointer items-center justify-between rounded-[var(--radius-card)] px-2 py-2 text-left text-sm transition-colors hover:bg-white/60 focus-visible:outline-none focus-visible:ring-2"
                style={{
                  backgroundColor: selected
                    ? "color-mix(in srgb, var(--color-progress) 12%, transparent)"
                    : undefined,
                }}
                aria-pressed={selected}
              >
                <span style={{ color: "var(--color-main)" }}>
                  {tPanel(WEEKDAY_KEYS[index]!)}{" "}
                  {new Date(`${iso}T12:00:00`).getDate()}
                </span>
                <span className="shrink-0 tabular-nums" style={{ color: "var(--color-secondary)" }}>
                  {stats.total === 0
                    ? t("week_day_empty")
                    : stats.percent === 100
                      ? t("week_day_done", {
                          done: stats.done,
                          total: stats.total,
                        })
                      : t("week_day_partial", {
                          done: stats.done,
                          total: stats.total,
                        })}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="mt-3 flex flex-col gap-2 border-t border-white/30 pt-3">
        <p className="text-center text-xs" style={{ color: "var(--color-secondary)" }}>
          {t("week_summary", {
            done: weekProgress.done,
            total: weekProgress.total,
          })}
        </p>
        {weekProgress.total > 0 ? (
          <ProgressBar value={weekProgress.percent} />
        ) : null}
      </div>
    </Card>
  );
}
