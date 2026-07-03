"use client";

import ChevronLeft from "lucide-react/dist/esm/icons/chevron-left.mjs";
import ChevronRight from "lucide-react/dist/esm/icons/chevron-right.mjs";
import { useLocale, useTranslations } from "next-intl";
import type { PlanTaskDto } from "@mentor/types";
import {
  formatWeekRangeLabel,
  shiftDate,
  taskStats,
  todayIso,
  weekDates,
} from "./plan-utils";
import { PlanWeekNavButton } from "./plan-week-nav-button";

const WEEKDAY_KEYS = [
  "week_mon",
  "week_tue",
  "week_wed",
  "week_thu",
  "week_fri",
  "week_sat",
  "week_sun",
] as const;

export type PlanWeekStripProps = {
  weekStartDate: string;
  selectedDate: string;
  weekTasks: Record<string, PlanTaskDto[]>;
  onWeekChange: (weekStart: string) => void;
  onDateChange: (iso: string) => void;
  compact?: boolean;
};

/** Shared 7-day strip + week arrows (mobile Hafta nav card). */
export function PlanWeekStrip({
  weekStartDate,
  selectedDate,
  weekTasks,
  onWeekChange,
  onDateChange,
  compact,
}: PlanWeekStripProps) {
  const t = useTranslations("plan");
  const tPanel = useTranslations("panel");
  const locale = useLocale();
  const days = weekDates(weekStartDate);
  const weekEnd = days[6]!;
  const weekDone = days.reduce(
    (acc, iso) =>
      acc + (weekTasks[iso]?.filter((x) => x.status === "DONE").length ?? 0),
    0,
  );
  const weekTotal = days.reduce(
    (acc, iso) => acc + (weekTasks[iso]?.length ?? 0),
    0,
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <PlanWeekNavButton
          label={t("prev_week_aria")}
          onClick={() => onWeekChange(shiftDate(weekStartDate, -7))}
          compact={compact}
        >
          <ChevronLeft size={compact ? 18 : 20} strokeWidth={2} aria-hidden />
        </PlanWeekNavButton>
        <p
          className={`text-center font-bold ${compact ? "text-sm" : "text-base"}`}
          style={{
            color: "var(--color-main)",
            fontFamily: "var(--font-heading)",
          }}
        >
          {formatWeekRangeLabel(weekStartDate, weekEnd, locale)}
        </p>
        <PlanWeekNavButton
          label={t("next_week_aria")}
          onClick={() => onWeekChange(shiftDate(weekStartDate, 7))}
          compact={compact}
        >
          <ChevronRight size={compact ? 18 : 20} strokeWidth={2} aria-hidden />
        </PlanWeekNavButton>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((iso, index) => {
          const { total, percent } = taskStats(weekTasks[iso] ?? []);
          const selected = iso === selectedDate;
          const dayIsToday = iso === todayIso();
          return (
            <button
              key={iso}
              type="button"
              onClick={() => onDateChange(iso)}
              className="flex min-h-[52px] cursor-pointer flex-col items-center justify-center gap-0.5 rounded-[var(--radius-card)] px-0.5 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none"
              style={{
                backgroundColor: selected
                  ? "color-mix(in srgb, var(--color-progress) 15%, transparent)"
                  : "transparent",
                boxShadow: selected
                  ? "inset 0 0 0 2px var(--color-progress)"
                  : undefined,
              }}
              aria-pressed={selected}
            >
              <span
                className="text-[10px] font-medium uppercase"
                style={{ color: "var(--color-secondary)" }}
              >
                {tPanel(WEEKDAY_KEYS[index]!)}
              </span>
              <span
                className="text-sm font-bold"
                style={{
                  color: dayIsToday
                    ? "var(--color-progress)"
                    : "var(--color-main)",
                  fontFamily: "var(--font-heading)",
                }}
              >
                {new Date(`${iso}T12:00:00`).getDate()}
              </span>
              <span
                className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full"
                style={{
                  backgroundColor:
                    total === 0
                      ? "var(--color-progress-track)"
                      : percent === 100
                        ? "#22C55E"
                        : "var(--color-progress)",
                }}
                aria-hidden
              />
            </button>
          );
        })}
      </div>

      <p
        className="text-center text-xs"
        style={{ color: "var(--color-secondary)" }}
      >
        {t("week_summary", { done: weekDone, total: weekTotal })}
      </p>
    </div>
  );
}
