"use client";

import type { PlanTaskDto } from "@mentor/types";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import { layoutDayEvents } from "@/lib/plan-calendar-layout";
import { planEventColor } from "@/lib/plan-event-colors";
import { formatTimeRange, isPastDate, todayIso } from "./plan-utils";

/** DOM id for a day block, so scroll-spy can measure without refs per day. */
function agendaDayId(iso: string): string {
  return `plan-agenda-day-${iso}`;
}

/** A section counts as "at the top" once its heading is within this much of the fold. */
const SPY_TOLERANCE_PX = 8;

/**
 * Mobile "Ajanda": every day of the visible month as a section, newest scroll position wins.
 * Scrolling re-selects the day under the top edge, which is what drives the date strip above.
 */
export function PlanMobileAgenda({
  days,
  selectedDate,
  tasksByDate,
  onDateChange,
  onOpenTask,
}: {
  /** The visible month's days, in order. */
  days: string[];
  selectedDate: string;
  tasksByDate: Record<string, PlanTaskDto[]>;
  onDateChange: (iso: string) => void;
  onOpenTask: (task: PlanTaskDto) => void;
}) {
  const t = useTranslations("plan");
  const locale = useLocale();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const today = todayIso();
  /** Set while WE scroll, so the resulting scroll events don't fight the user's selection. */
  const suppressSpyRef = useRef(false);
  const lastEmittedRef = useRef(selectedDate);

  const sections = useMemo(
    () =>
      days.map((iso) => {
        const dayTasks = tasksByDate[iso] ?? [];
        return { iso, ...layoutDayEvents(dayTasks), count: dayTasks.length };
      }),
    [days, tasksByDate],
  );

  const scrollToDay = useCallback((iso: string) => {
    const scroller = scrollerRef.current;
    const section = document.getElementById(agendaDayId(iso));
    if (!scroller || !section) return;
    suppressSpyRef.current = true;
    scroller.scrollTo({ top: section.offsetTop, behavior: "auto" });
    window.setTimeout(() => {
      suppressSpyRef.current = false;
    }, 120);
  }, []);

  /**
   * Open on the selected day, not on the grid's first cell — the month range starts on the
   * Monday before the 1st, so an unaligned scroller lands the reader days (or weeks) in the past.
   * Layout effect so it happens before paint; re-runs only when the month range itself changes.
   */
  const alignedRangeRef = useRef<string | null>(null);
  useLayoutEffect(() => {
    const rangeKey = days[0] ?? "";
    if (alignedRangeRef.current === rangeKey) return;
    alignedRangeRef.current = rangeKey;
    lastEmittedRef.current = selectedDate;
    scrollToDay(selectedDate);
  }, [days, selectedDate, scrollToDay]);

  // The strip (or any other surface) picked a day → bring it to the top.
  useEffect(() => {
    if (selectedDate === lastEmittedRef.current) return;
    lastEmittedRef.current = selectedDate;
    scrollToDay(selectedDate);
  }, [selectedDate, scrollToDay]);

  /**
   * Section tops, cached so a scroll frame is a scan over numbers instead of 42 DOM lookups.
   * Re-measured whenever the day set or its content changes the layout.
   */
  const offsetsRef = useRef<{ iso: string; top: number }[]>([]);
  useLayoutEffect(() => {
    offsetsRef.current = days.map((iso) => ({
      iso,
      top: document.getElementById(agendaDayId(iso))?.offsetTop ?? 0,
    }));
  }, [days, sections]);

  const frameRef = useRef<number | null>(null);
  const onScroll = useCallback(() => {
    // Coalesce to one reading per frame — scroll fires far faster than the strip can move.
    if (frameRef.current !== null) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      const scroller = scrollerRef.current;
      if (!scroller || suppressSpyRef.current) return;
      const top = scroller.scrollTop + SPY_TOLERANCE_PX;
      let active: string | undefined;
      for (const { iso, top: sectionTop } of offsetsRef.current) {
        // The last section whose top has passed the fold is the one at the reader's top edge.
        if (sectionTop <= top) active = iso;
        else break;
      }
      if (active && active !== lastEmittedRef.current) {
        lastEmittedRef.current = active;
        onDateChange(active);
      }
    });
  }, [onDateChange]);

  useEffect(
    () => () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    },
    [],
  );

  return (
    /* `relative` is load-bearing: a section's `offsetTop` is measured against its offsetParent,
       so without it every reading is shifted by the scroller's own position on the page and the
       spy (and the initial alignment) lands days away from where the reader actually is. */
    <div
      ref={scrollerRef}
      onScroll={onScroll}
      className="relative flex max-h-[60vh] flex-col overflow-y-auto lg:hidden"
    >
      {sections.map(({ iso, allDay, timed, count }) => {
        const isToday = iso === today;
        const date = new Date(`${iso}T12:00:00`);
        const loc = locale === "en" ? "en-GB" : "tr-TR";
        return (
          <section
            key={iso}
            id={agendaDayId(iso)}
            className="flex flex-col gap-2 border-b py-3 last:border-b-0"
            style={{
              borderColor: "color-mix(in srgb, var(--color-main) 8%, transparent)",
              opacity: isPastDate(iso) ? 0.7 : 1,
            }}
          >
            <header className="flex items-baseline gap-2">
              <h3
                className="text-lg font-bold"
                style={{
                  color: isToday ? "var(--color-progress)" : "var(--color-main)",
                  fontFamily: "var(--font-heading)",
                }}
              >
                {date.toLocaleDateString(loc, { day: "numeric", month: "short" })}
              </h3>
              <span className="text-sm" style={{ color: "var(--color-secondary)" }}>
                {isToday
                  ? t("today")
                  : date.toLocaleDateString(loc, { weekday: "long" })}
              </span>
            </header>

            {count === 0 ? (
              <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
                {t("timeline_day_empty")}
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {[
                  ...allDay.map((task) => ({ task, range: null as string | null })),
                  ...timed.map(({ event }) => ({
                    task: event,
                    range: formatTimeRange(event.startTime, event.endTime),
                  })),
                ].map(({ task, range }) => {
                  const color = planEventColor(task.subject);
                  const done = task.status === "DONE";
                  return (
                    <li key={task.id}>
                      <button
                        type="button"
                        onClick={() => onOpenTask(task)}
                        className="flex w-full min-h-11 cursor-pointer items-start gap-3 rounded-[var(--radius-card)] px-1 py-1.5 text-left focus-visible:outline-none focus-visible:ring-2"
                      >
                        <span
                          className="w-16 shrink-0 pt-0.5 text-xs tabular-nums"
                          style={{ color: "var(--color-secondary)" }}
                        >
                          {range ?? t("all_day")}
                        </span>
                        <span
                          aria-hidden
                          className="mt-1 h-4 w-1 shrink-0 rounded-full"
                          style={{ backgroundColor: color.bar }}
                        />
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span
                            className={`truncate text-base ${done ? "line-through opacity-70" : "font-medium"}`}
                            style={{ color: "var(--color-main)" }}
                          >
                            {task.title}
                          </span>
                          {task.subject ? (
                            <span
                              className="truncate text-xs"
                              style={{ color: "var(--color-secondary)" }}
                            >
                              {task.subject}
                            </span>
                          ) : null}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
