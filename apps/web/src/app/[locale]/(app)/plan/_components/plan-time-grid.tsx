"use client";

import type { PublicHolidayDto } from "@mentor/types";
import { useEffect, useMemo, useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  earliestStartMinute,
  hhmmFromMinutes,
  layoutDayEvents,
} from "@/lib/plan-calendar-layout";
import type { PlanCalendarItem } from "@/lib/plan-calendar-item";
import { PlanEventChip, type PlanEventHoverHandler } from "./plan-event-chip";
import {
  formatDayNumber,
  formatWeekdayShort,
  isPastDate,
  todayIso,
  type PlanCalendarCopyNamespace,
} from "./plan-utils";

/** One hour of column height. Kept in px (not %) so a day scrolls instead of squashing. */
const HOUR_PX = 56;
/** Where the scroller lands when the day has no timed event. */
const DEFAULT_SCROLL_MINUTE = 7 * 60;
const HOURS = Array.from({ length: 24 }, (_, i) => i);

/**
 * Hour grid for the Gün (one column) and Hafta (seven columns) scales — same component, the
 * column count is just `days.length`. All-day items sit in a pinned row above the scroller.
 */
export function PlanTimeGrid<T>({
  days,
  selectedDate,
  itemsByDate,
  holidaysByDate,
  readOnlyAll,
  namespace = "plan",
  onDateChange,
  onOpenItem,
  onCreateAt,
  onHover,
}: {
  days: string[];
  selectedDate: string;
  itemsByDate: Record<string, PlanCalendarItem<T>[]>;
  holidaysByDate: Record<string, PublicHolidayDto>;
  /** Whole surface is read-only (past week) — slot clicks are disabled. */
  readOnlyAll?: boolean;
  namespace?: PlanCalendarCopyNamespace;
  onDateChange: (iso: string) => void;
  onOpenItem: (source: T, trigger: HTMLButtonElement) => void;
  /** Empty-slot click → create flow prefilled with the day and the clicked hour. */
  onCreateAt: (iso: string, startTime: string) => void;
  onHover: PlanEventHoverHandler<T>;
}) {
  const t = useTranslations(namespace);
  const locale = useLocale();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const today = todayIso();
  const multiDay = days.length > 1;

  const layouts = useMemo(
    () => days.map((iso) => ({ iso, ...layoutDayEvents(itemsByDate[iso] ?? []) })),
    [days, itemsByDate],
  );

  const hasHoliday = days.some((iso) => holidaysByDate[iso]);
  const hasAllDay = hasHoliday || layouts.some((day) => day.allDay.length > 0);

  const firstMinute = useMemo(
    () =>
      earliestStartMinute(
        days.flatMap((iso) => itemsByDate[iso] ?? []),
        DEFAULT_SCROLL_MINUTE,
      ),
    [days, itemsByDate],
  );

  // Land on the first event (or 07:00) so the user isn't staring at empty night hours.
  const firstDay = days[0];
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    scroller.scrollTop = Math.max(0, (firstMinute / 60) * HOUR_PX - HOUR_PX / 2);
  }, [firstMinute, firstDay]);

  return (
    <div className="flex min-w-0 flex-col lg:min-h-0 lg:flex-1">
      {/* Day headers */}
      <div
        className="grid border-b pb-2"
        style={{
          gridTemplateColumns: `3rem repeat(${days.length}, minmax(0, 1fr))`,
          borderColor: "color-mix(in srgb, var(--color-main) 10%, transparent)",
        }}
      >
        <span aria-hidden />
        {days.map((iso) => {
          const isToday = iso === today;
          const isSelected = iso === selectedDate;
          return (
            <button
              key={iso}
              type="button"
              data-date={iso}
              onClick={() => onDateChange(iso)}
              aria-pressed={isSelected}
              aria-current={isToday ? "date" : undefined}
              className="flex min-h-11 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-[var(--radius-card)] focus-visible:outline-none focus-visible:ring-2"
            >
              {multiDay ? (
                <span
                  className="text-[10px] font-medium uppercase leading-none"
                  style={{ color: "var(--color-secondary)" }}
                >
                  {formatWeekdayShort(iso, locale)}
                </span>
              ) : null}
              <span
                className="flex h-8 min-w-8 items-center justify-center rounded-full px-1.5 text-sm font-bold leading-none"
                style={{
                  fontFamily: "var(--font-heading)",
                  color: isToday ? "#fff" : "var(--color-main)",
                  backgroundColor: isToday
                    ? "var(--color-progress)"
                    : isSelected
                      ? "var(--color-accent-soft)"
                      : "transparent",
                }}
              >
                {formatDayNumber(iso)}
              </span>
            </button>
          );
        })}
      </div>

      {/* All-day row */}
      {hasAllDay ? (
        <div
          className="grid gap-1 border-b py-1.5"
          style={{
            gridTemplateColumns: `3rem repeat(${days.length}, minmax(0, 1fr))`,
            borderColor: "color-mix(in srgb, var(--color-main) 10%, transparent)",
          }}
        >
          <span
            className="self-center pr-1 text-right text-[10px] leading-tight"
            style={{ color: "var(--color-secondary)" }}
          >
            {t("all_day")}
          </span>
          {layouts.map((day) => {
            const holiday = holidaysByDate[day.iso];
            return (
              <div key={day.iso} className="flex min-w-0 flex-col gap-1">
                {/* Flat band, no leading bar and no click — reads as a fact about the day
                    rather than something the user put there. */}
                {holiday ? (
                  <span
                    className="block truncate rounded-[6px] px-1.5 py-[3px] text-[11px] leading-tight opacity-75"
                    style={{
                      backgroundColor:
                        "color-mix(in srgb, var(--color-chip-text) 10%, transparent)",
                      color: "var(--color-chip-text)",
                    }}
                    title={holiday.name}
                  >
                    {holiday.name}
                  </span>
                ) : null}
                {day.allDay.map((item) => (
                  <PlanEventChip
                    key={item.id}
                    item={item}
                    variant="month"
                    onOpen={onOpenItem}
                    onHover={onHover}
                  />
                ))}
              </div>
            );
          })}
        </div>
      ) : null}

      {/* Hour grid */}
      {/* Mobile keeps a viewport-relative cap (the page scrolls); on desktop the parent flex
          chain hands down the exact remaining height, so nothing spills past the fold. */}
      <div
        ref={scrollerRef}
        className="mentor-plan-timegrid-scroll max-h-[60vh] overflow-y-auto lg:max-h-none lg:min-h-0 lg:flex-1"
      >
        <div
          className="grid"
          style={{ gridTemplateColumns: `3rem repeat(${days.length}, minmax(0, 1fr))` }}
        >
          {/* Hour gutter */}
          <div className="relative" style={{ height: 24 * HOUR_PX }} aria-hidden>
            {HOURS.map((hour) => (
              <span
                key={hour}
                className="absolute right-1.5 -translate-y-1/2 text-[10px] tabular-nums"
                style={{ top: hour * HOUR_PX, color: "var(--color-secondary)" }}
              >
                {hour === 0 ? "" : `${String(hour).padStart(2, "0")}:00`}
              </span>
            ))}
          </div>

          {layouts.map((day) => {
            const dayReadOnly = readOnlyAll || isPastDate(day.iso);
            return (
              <div
                key={day.iso}
                className="relative border-l"
                style={{
                  height: 24 * HOUR_PX,
                  borderColor: "color-mix(in srgb, var(--color-main) 8%, transparent)",
                }}
              >
                {HOURS.map((hour) => (
                  <button
                    key={hour}
                    type="button"
                    disabled={dayReadOnly}
                    onClick={() => onCreateAt(day.iso, hhmmFromMinutes(hour * 60))}
                    aria-label={t("calendar_add_at", {
                      // In Hafta every column repeats the same hours — the weekday keeps each
                      // slot's accessible name unique.
                      time: `${multiDay ? `${formatWeekdayShort(day.iso, locale)} ` : ""}${String(hour).padStart(2, "0")}:00`,
                    })}
                    className="absolute inset-x-0 w-full border-t transition-colors hover:bg-[color-mix(in_srgb,var(--color-surface)_70%,transparent)] focus-visible:outline-none focus-visible:ring-2 disabled:cursor-default disabled:hover:bg-transparent motion-reduce:transition-none"
                    style={{
                      top: hour * HOUR_PX,
                      height: HOUR_PX,
                      borderColor:
                        "color-mix(in srgb, var(--color-main) 7%, transparent)",
                      cursor: dayReadOnly ? "default" : "pointer",
                    }}
                  />
                ))}

                {day.timed.map((placed) => (
                  <PlanEventChip
                    key={placed.event.id}
                    item={placed.event}
                    variant="block"
                    onOpen={onOpenItem}
                    onHover={onHover}
                    style={{
                      top: `${placed.topPct}%`,
                      height: `${placed.heightPct}%`,
                      left: `calc(${(placed.col / placed.colCount) * 100}% + 2px)`,
                      width: `calc(${100 / placed.colCount}% - 4px)`,
                    }}
                  />
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
