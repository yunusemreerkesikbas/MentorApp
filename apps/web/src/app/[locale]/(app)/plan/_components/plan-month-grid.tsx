"use client";

import type { PlanTaskDto, PublicHolidayDto } from "@mentor/types";
import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { monthGridDays } from "@/lib/plan-calendar-layout";
import {
  PlanEventChip,
  spotlightDelay,
  type PlanEventHoverHandler,
} from "./plan-event-chip";
import { formatDateLabel, isPastDate, todayIso } from "./plan-utils";

const WEEKDAY_KEYS = [
  "week_mon",
  "week_tue",
  "week_wed",
  "week_thu",
  "week_fri",
  "week_sat",
  "week_sun",
] as const;

/** Chips a cell shows before collapsing the rest into "+N". */
const MAX_CHIPS = 3;

/**
 * Month grid — plain CSS grid rather than react-day-picker: the mini calendar in the left rail
 * still uses the picker, but a 6×7 board with event chips per cell is less code standalone than
 * overriding the picker's day rendering.
 */
export function PlanMonthGrid({
  monthAnchor,
  selectedDate,
  tasksByDate,
  holidaysByDate,
  highlightSubject,
  onDateChange,
  onOpenTask,
  onCreateAt,
  onHover,
}: {
  /** Any ISO date inside the month being shown. */
  monthAnchor: string;
  selectedDate: string;
  tasksByDate: Record<string, PlanTaskDto[]>;
  holidaysByDate: Record<string, PublicHolidayDto>;
  /** Legend selection — everything else fades back. Null = no highlight. */
  highlightSubject: string | null;
  onDateChange: (iso: string) => void;
  onOpenTask: (task: PlanTaskDto) => void;
  onCreateAt: (iso: string) => void;
  onHover: PlanEventHoverHandler;
}) {
  const t = useTranslations("plan");
  const tPanel = useTranslations("panel");
  const locale = useLocale();
  const today = todayIso();
  const monthKey = monthAnchor.slice(0, 7);

  const days = useMemo(() => {
    const d = new Date(`${monthAnchor}T12:00:00`);
    return monthGridDays(d.getFullYear(), d.getMonth());
  }, [monthAnchor]);

  /**
   * Ramp-up counter for the stage light. Incremented as the board renders in reading order, so
   * lit chips come on left-to-right / top-to-bottom instead of all at once.
   */
  let litIndex = 0;

  return (
    <div className="flex h-full min-w-0 flex-col gap-1">
      <div className="grid shrink-0 grid-cols-7 gap-1">
        {WEEKDAY_KEYS.map((key) => (
          <span
            key={key}
            className="px-1 text-[10px] font-medium uppercase leading-none"
            style={{ color: "var(--color-secondary)" }}
          >
            {tPanel(key)}
          </span>
        ))}
      </div>

      {/* Six equal rows that share whatever height the card has left — otherwise the board keeps
          its min-height and leaves dead space under the last week. */}
      <div className="grid min-h-0 flex-1 grid-cols-7 grid-rows-6 gap-1">
        {days.map((iso) => {
          const tasks = tasksByDate[iso] ?? [];
          const outside = iso.slice(0, 7) !== monthKey;
          const isToday = iso === today;
          const isSelected = iso === selectedDate;
          const dayReadOnly = isPastDate(iso);
          const shown = tasks.slice(0, MAX_CHIPS);
          const overflow = tasks.length - shown.length;
          const dayLabel = formatDateLabel(iso, locale, t("today"), {
            alwaysFull: true,
          });
          const holiday = holidaysByDate[iso];

          return (
            <div
              key={iso}
              className="relative flex min-h-24 min-w-0 flex-col gap-1 overflow-hidden rounded-[var(--radius-card)] border p-1"
              style={{
                borderColor: isSelected
                  ? "var(--color-progress)"
                  : "color-mix(in srgb, var(--color-main) 8%, transparent)",
                backgroundColor: outside
                  ? "color-mix(in srgb, var(--color-surface-container) 45%, transparent)"
                  : holiday
                    ? "color-mix(in srgb, var(--color-chip-text) 5%, transparent)"
                    : "transparent",
                opacity: outside ? 0.65 : 1,
              }}
            >
              {/* The whole cell is the add target; chips and "+N" sit above it and take their
                  own clicks. Past days can only be opened, not added to. */}
              <button
                type="button"
                onClick={() => (dayReadOnly ? onDateChange(iso) : onCreateAt(iso))}
                aria-current={isToday ? "date" : undefined}
                aria-label={
                  dayReadOnly
                    ? t("calendar_open_day", { date: dayLabel })
                    : t("calendar_add_on", { date: dayLabel })
                }
                className="absolute inset-0 cursor-pointer rounded-[var(--radius-card)] transition-colors hover:bg-[color-mix(in_srgb,var(--color-surface)_60%,transparent)] focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none"
              />

              <span
                className="pointer-events-none relative flex h-6 min-w-6 self-start items-center justify-center rounded-full px-1 text-xs font-bold leading-none"
                style={{
                  fontFamily: "var(--font-heading)",
                  color: isToday
                    ? "#fff"
                    : holiday
                      ? "var(--color-chip-text)"
                      : "var(--color-main)",
                  backgroundColor: isToday ? "var(--color-progress)" : "transparent",
                }}
              >
                {Number(iso.slice(8))}
              </span>

              {/* Editorial fact, not a plan item — plain text, above the chips, not clickable. */}
              {holiday ? (
                <span
                  className="pointer-events-none relative block truncate px-0.5 text-[10px] leading-tight opacity-75"
                  style={{ color: "var(--color-chip-text)" }}
                  title={holiday.name}
                >
                  {holiday.name}
                </span>
              ) : null}

              <div className="relative flex min-w-0 flex-col gap-0.5">
                {shown.map((task) => {
                  const matches = task.subject?.trim() === highlightSubject;
                  const spotlight =
                    highlightSubject === null
                      ? "off"
                      : matches
                        ? "lit"
                        : "dimmed";
                  return (
                    <PlanEventChip
                      key={task.id}
                      task={task}
                      variant="month"
                      spotlight={spotlight}
                      spotlightDelayMs={
                        spotlight === "lit" ? spotlightDelay(litIndex++) : 0
                      }
                      onOpen={onOpenTask}
                      onHover={onHover}
                    />
                  );
                })}
                {overflow > 0 ? (
                  <button
                    type="button"
                    onClick={() => onDateChange(iso)}
                    className="cursor-pointer px-1 text-left text-[10px] font-semibold focus-visible:outline-none focus-visible:ring-2"
                    style={{ color: "var(--color-accent)" }}
                  >
                    {t("calendar_more", { count: overflow })}
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
