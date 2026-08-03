"use client";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
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

const dayPillTransition = {
  type: "tween" as const,
  duration: 0.2,
  ease: [0.22, 1, 0.36, 1] as const,
};

export type PlanWeekStripProps = {
  weekStartDate: string;
  selectedDate: string;
  weekTasks: Record<string, PlanTaskDto[]>;
  onWeekChange: (weekStart: string) => void;
  onDateChange: (iso: string) => void;
  compact?: boolean;
  /** Optional calendar sheet entry (Liste / Timeline). */
  onOpenCalendar?: () => void;
  /** Hide week progress caption (Liste / Timeline use day progress below). */
  hideSummary?: boolean;
};

/** Shared 7-day strip + week arrows. */
export function PlanWeekStrip({
  weekStartDate,
  selectedDate,
  weekTasks,
  onWeekChange,
  onDateChange,
  compact,
  onOpenCalendar,
  hideSummary,
}: PlanWeekStripProps) {
  const t = useTranslations("plan");
  const tPanel = useTranslations("panel");
  const locale = useLocale();
  const reduceMotion = useReducedMotion();
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

  // Slide direction from the week that was rendered last. State (not refs) — refs must not be
  // read or written during render; this is React's "adjusting state when props change" pattern
  // and it covers arbitrary jumps, not just the prev/next buttons.
  const [renderedWeek, setRenderedWeek] = useState(weekStartDate);
  const [direction, setDirection] = useState(0);
  if (weekStartDate !== renderedWeek) {
    setDirection(weekStartDate > renderedWeek ? 1 : -1);
    setRenderedWeek(weekStartDate);
  }

  function goWeek(delta: -7 | 7) {
    onWeekChange(shiftDate(weekStartDate, delta));
  }

  const slide = reduceMotion
    ? undefined
    : {
        initial: { opacity: 0, x: direction * 12 },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: direction * -12 },
        transition: { duration: 0.18, ease: [0.22, 1, 0.36, 1] as const },
      };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <PlanWeekNavButton
          label={t("prev_week_aria")}
          onClick={() => goWeek(-7)}
          compact={compact}
        >
          <ChevronLeft size={compact ? 18 : 20} strokeWidth={2} aria-hidden />
        </PlanWeekNavButton>
        <p
          className="min-w-0 flex-1 truncate text-center text-sm font-bold whitespace-nowrap"
          style={{
            color: "var(--color-main)",
            fontFamily: "var(--font-heading)",
          }}
        >
          {formatWeekRangeLabel(weekStartDate, weekEnd, locale)}
        </p>
        <div className="flex shrink-0 items-center gap-0.5">
          {onOpenCalendar ? (
            <PlanWeekNavButton
              label={t("calendar_aria")}
              onClick={onOpenCalendar}
              compact={compact}
            >
              <Calendar size={compact ? 18 : 20} strokeWidth={2} aria-hidden />
            </PlanWeekNavButton>
          ) : null}
          <PlanWeekNavButton
            label={t("next_week_aria")}
            onClick={() => goWeek(7)}
            compact={compact}
          >
            <ChevronRight size={compact ? 18 : 20} strokeWidth={2} aria-hidden />
          </PlanWeekNavButton>
        </div>
      </div>

      <div className="overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={weekStartDate}
            className="grid grid-cols-7 gap-1"
            {...(slide ?? {})}
          >
            {days.map((iso, index) => {
              const { total, percent } = taskStats(weekTasks[iso] ?? []);
              const selected = iso === selectedDate;
              const dayIsToday = iso === todayIso();
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => onDateChange(iso)}
                  className="flex min-h-11 cursor-pointer flex-col items-center gap-1 rounded-[var(--radius-card)] px-0.5 py-1 focus-visible:outline-none focus-visible:ring-2"
                  aria-pressed={selected}
                  aria-current={dayIsToday ? "date" : undefined}
                >
                  <span
                    className="text-[10px] font-medium uppercase leading-none"
                    style={{ color: "var(--color-secondary)" }}
                  >
                    {tPanel(WEEKDAY_KEYS[index]!)}
                  </span>
                  <span className="relative flex size-9 items-center justify-center">
                    {selected ? (
                      reduceMotion ? (
                        <span
                          className="absolute inset-0 rounded-full"
                          style={{
                            backgroundColor: "var(--color-accent-soft)",
                          }}
                          aria-hidden
                        />
                      ) : (
                        <motion.span
                          layoutId="plan-day-selected"
                          className="absolute inset-0 rounded-full"
                          style={{
                            backgroundColor: "var(--color-accent-soft)",
                          }}
                          transition={dayPillTransition}
                          aria-hidden
                        />
                      )
                    ) : null}
                    <span
                      className={`relative z-10 leading-none ${
                        dayIsToday
                          ? "text-base font-extrabold"
                          : "text-sm font-bold"
                      }`}
                      style={{
                        color: dayIsToday
                          ? "var(--color-progress)"
                          : "var(--color-main)",
                        fontFamily: "var(--font-heading)",
                      }}
                    >
                      {new Date(`${iso}T12:00:00`).getDate()}
                    </span>
                  </span>
                  <span
                    className="flex h-1.5 w-1.5 shrink-0 items-center justify-center"
                    aria-hidden
                  >
                    {total > 0 ? (
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{
                          backgroundColor:
                            percent === 100
                              ? "var(--color-success)"
                              : "var(--color-progress)",
                        }}
                      />
                    ) : null}
                  </span>
                </button>
              );
            })}
          </motion.div>
        </AnimatePresence>
      </div>

      {!hideSummary ? (
        <p
          className="text-center text-xs"
          style={{ color: "var(--color-secondary)" }}
        >
          {t("week_summary", { done: weekDone, total: weekTotal })}
        </p>
      ) : null}
    </div>
  );
}
