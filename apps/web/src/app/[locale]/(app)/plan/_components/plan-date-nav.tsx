"use client";

import type { ReactNode } from "react";
import Calendar from "lucide-react/dist/esm/icons/calendar.mjs";
import ChevronLeft from "lucide-react/dist/esm/icons/chevron-left.mjs";
import ChevronRight from "lucide-react/dist/esm/icons/chevron-right.mjs";
import { useLocale, useTranslations } from "next-intl";
import type { PlanTaskDto } from "@mentor/types";
import { Card } from "@mentor/ui";
import { PlanProgress } from "./plan-progress";
import {
  formatDateLabel,
  formatWeekRangeLabel,
  isPastDate,
  shiftDate,
  taskStats,
  todayIso,
  type PlanViewMode,
  weekDates,
  weekStart,
} from "./plan-utils";

const WEEKDAY_KEYS = [
  "week_mon",
  "week_tue",
  "week_wed",
  "week_thu",
  "week_fri",
  "week_sat",
  "week_sun",
] as const;

export type PlanDateNavProps = {
  date: string;
  viewMode: PlanViewMode;
  weekStartDate: string;
  weekTasks?: Record<string, PlanTaskDto[]>;
  progress?: { done: number; total: number; percent: number };
  onDateChange: (iso: string) => void;
  onWeekChange: (weekStart: string) => void;
  onOpenCalendar: () => void;
};

/** Unified date bar — same shell under view switcher in Liste / Timeline / Hafta. */
export function PlanDateNav({
  date,
  viewMode,
  weekStartDate,
  weekTasks = {},
  progress,
  onDateChange,
  onWeekChange,
  onOpenCalendar,
}: PlanDateNavProps) {
  const t = useTranslations("plan");
  const tPanel = useTranslations("panel");
  const locale = useLocale();
  const isToday = date === todayIso();
  const isPast = isPastDate(date);
  const primaryLabel = formatDateLabel(date, locale, t("today"), {
    alwaysFull: true,
  });

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
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <NavIconButton
          label={t("prev_day_aria")}
          onClick={() => {
            const next = shiftDate(date, -1);
            onDateChange(next);
            if (viewMode === "week") onWeekChange(weekStart(next));
          }}
        >
          <ChevronLeft size={20} strokeWidth={2} aria-hidden />
        </NavIconButton>

        <div className="flex min-w-0 flex-1 flex-col items-center gap-1 px-1">
          {!isToday && !isPast ? (
            <button
              type="button"
              onClick={() => {
                const today = todayIso();
                onDateChange(today);
                if (viewMode === "week") onWeekChange(weekStart(today));
              }}
              className="rounded-full px-2.5 py-0.5 text-xs font-bold transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2"
              style={{
                backgroundColor:
                  "color-mix(in srgb, var(--color-progress-track) 45%, transparent)",
                color: "var(--color-progress)",
                fontFamily: "var(--font-body)",
              }}
            >
              {t("go_today")}
            </button>
          ) : null}
          <p
            className="text-center text-base font-bold leading-tight"
            style={{
              color: "var(--color-main)",
              fontFamily: "var(--font-heading)",
            }}
          >
            {primaryLabel}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          <NavIconButton label={t("calendar_aria")} onClick={onOpenCalendar}>
            <Calendar size={20} strokeWidth={2} aria-hidden />
          </NavIconButton>
          <NavIconButton
            label={t("next_day_aria")}
            onClick={() => {
              const next = shiftDate(date, 1);
              onDateChange(next);
              if (viewMode === "week") onWeekChange(weekStart(next));
            }}
          >
            <ChevronRight size={20} strokeWidth={2} aria-hidden />
          </NavIconButton>
        </div>
      </div>

      {progress && progress.total > 0 ? (
        <div
          className="flex flex-col gap-1.5 border-t border-white/30 pt-3"
        >
          <div className="flex items-center justify-between text-sm font-semibold">
            <span style={{ color: "var(--color-main)" }}>
              {t("progress", { done: progress.done, total: progress.total })}
            </span>
            <span style={{ color: "var(--color-secondary)" }}>
              {t("progress_percent", { percent: progress.percent })}
            </span>
          </div>
          <PlanProgress value={progress.percent} />
        </div>
      ) : null}

      {viewMode === "week" ? (
        <div className="flex flex-col gap-3 border-t border-white/30 pt-3">
          <div className="flex items-center justify-between gap-2">
            <NavIconButton
              label={t("prev_week_aria")}
              onClick={() => onWeekChange(shiftDate(weekStartDate, -7))}
            >
              <ChevronLeft size={18} strokeWidth={2} aria-hidden />
            </NavIconButton>
            <p
              className="text-center text-sm font-bold"
              style={{
                color: "var(--color-main)",
                fontFamily: "var(--font-heading)",
              }}
            >
              {formatWeekRangeLabel(weekStartDate, weekEnd, locale)}
            </p>
            <NavIconButton
              label={t("next_week_aria")}
              onClick={() => onWeekChange(shiftDate(weekStartDate, 7))}
            >
              <ChevronRight size={18} strokeWidth={2} aria-hidden />
            </NavIconButton>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {days.map((iso, index) => {
              const { total, percent } = taskStats(weekTasks[iso] ?? []);
              const selected = iso === date;
              const dayIsToday = iso === todayIso();
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => onDateChange(iso)}
                  className="flex min-h-[52px] flex-col items-center justify-center rounded-[var(--radius-card)] px-0.5 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2"
                  style={{
                    backgroundColor: selected
                      ? "color-mix(in srgb, var(--color-progress) 15%, transparent)"
                      : "transparent",
                    boxShadow: selected
                      ? "inset 0 0 0 2px var(--color-progress)"
                      : undefined,
                  }}
                  aria-label={formatDateLabel(iso, locale, t("today"))}
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
                    className="mt-1 h-1.5 w-1.5 rounded-full"
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
      ) : null}
    </Card>
  );
}

function NavIconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-11 min-w-11 items-center justify-center rounded-[var(--radius-card)] transition-colors hover:bg-white/60 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none"
      style={{ color: "var(--color-main)" }}
      aria-label={label}
    >
      {children}
    </button>
  );
}
