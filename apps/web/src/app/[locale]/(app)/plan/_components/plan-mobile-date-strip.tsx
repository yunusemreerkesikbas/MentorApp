"use client";

import type { PlanTaskDto } from "@mentor/types";
import { motion, useReducedMotion } from "framer-motion";
import { useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { monthGridDays } from "@/lib/plan-calendar-layout";
import { planEventColor } from "@/lib/plan-event-colors";
import { isPastDate, monthStart, todayIso, weekDates } from "./plan-utils";

const WEEKDAY_KEYS = [
  "week_mon",
  "week_tue",
  "week_wed",
  "week_thu",
  "week_fri",
  "week_sat",
  "week_sun",
] as const;

/**
 * One week row: the day-number band (COLLAPSED_PX) plus room for two event chips and the "+N"
 * line underneath. Keep the slack — at an exact fit the overflow line gets clipped in Ay.
 */
const ROW_PX = 84;
const ROWS = 6;
/**
 * Collapsed the board is a plain date strip: the viewport is cropped to the day-number band, so
 * the chips below it are simply out of frame (Gün / Ajanda). Expanding reveals them along with
 * the remaining weeks — one interpolated height, no second layout to keep in sync.
 *
 * Must stay BELOW where the chips start (pt-1 + size-8 number + the gap below it), otherwise
 * their top edge bleeds into the strip as stray colored slivers.
 */
const COLLAPSED_PX = 40;
const EXPANDED_PX = ROWS * ROW_PX;
const TRAVEL_PX = EXPANDED_PX - COLLAPSED_PX;
/** Chips a cell shows before the rest collapse into "+N". */
const MAX_CHIPS = 2;

/** Snappy enough to keep up with a scroll, damped enough not to overshoot between neighbours. */
const selectedPillTransition = {
  type: "spring" as const,
  stiffness: 420,
  damping: 36,
};

/**
 * Mobile month board that doubles as the date strip: collapsed it shows only the selected week,
 * and dragging the handle reveals the rest of the month CONTINUOUSLY — the container height and
 * the row offset both interpolate with the pointer, so there is no separate "strip" and "month
 * grid" to reconcile. Releasing past the halfway point snaps to Ay, below it back to Gün.
 */
export function PlanMobileDateStrip({
  selectedDate,
  weekStartDate,
  tasksByDate,
  expanded,
  onDateChange,
  onOpenTask,
  onExpand,
  onCollapse,
}: {
  selectedDate: string;
  weekStartDate: string;
  tasksByDate: Record<string, PlanTaskDto[]>;
  /** True while Ay is the active scale. */
  expanded: boolean;
  onDateChange: (iso: string) => void;
  onOpenTask: (task: PlanTaskDto) => void;
  onExpand: () => void;
  onCollapse: () => void;
}) {
  const t = useTranslations("plan");
  const tPanel = useTranslations("panel");
  const reduceMotion = useReducedMotion();
  const today = todayIso();
  const dragStartY = useRef<number | null>(null);
  /** 0 = one week, 1 = whole month. Null while not dragging (the scale decides). */
  const [dragProgress, setDragProgress] = useState<number | null>(null);

  const monthAnchor = monthStart(selectedDate);
  const days = useMemo(() => {
    const d = new Date(`${monthAnchor}T12:00:00`);
    return monthGridDays(d.getFullYear(), d.getMonth());
  }, [monthAnchor]);

  /** Which of the six rows holds the selected week — the one kept visible when collapsed. */
  const weekRow = useMemo(() => {
    const index = days.indexOf(weekDates(weekStartDate)[0]!);
    return index < 0 ? 0 : Math.floor(index / 7);
  }, [days, weekStartDate]);

  const base = expanded ? 1 : 0;
  const progress = dragProgress ?? base;
  const dragging = dragProgress !== null;

  function onPointerDown(event: React.PointerEvent<HTMLElement>) {
    dragStartY.current = event.clientY;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: React.PointerEvent<HTMLElement>) {
    const start = dragStartY.current;
    if (start === null) return;
    const next = base + (event.clientY - start) / TRAVEL_PX;
    setDragProgress(Math.min(1, Math.max(0, next)));
  }

  function onPointerUp() {
    if (dragStartY.current === null) return;
    dragStartY.current = null;
    const settled = (dragProgress ?? base) > 0.5;
    setDragProgress(null);
    if (settled !== expanded) (settled ? onExpand : onCollapse)();
  }

  const transition = dragging ? "none" : "height 240ms cubic-bezier(0.22, 1, 0.36, 1)";

  return (
    <div className="flex flex-col lg:hidden">
      <div className="grid grid-cols-7">
        {WEEKDAY_KEYS.map((key) => (
          <span
            key={key}
            className="pb-1 text-center text-[11px] font-medium uppercase leading-none"
            style={{ color: "var(--color-secondary)" }}
          >
            {tPanel(key)}
          </span>
        ))}
      </div>

      <div
        className="overflow-hidden"
        style={{ height: COLLAPSED_PX + progress * TRAVEL_PX, transition }}
      >
        {/* Gridless board — the day numbers and chips carry the structure on their own. */}
        <div
          className="grid grid-cols-7"
          style={{
            transform: `translateY(${-(1 - progress) * weekRow * ROW_PX}px)`,
            transition: dragging
              ? "none"
              : "transform 240ms cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        >
          {days.map((iso) => {
            const tasks = tasksByDate[iso] ?? [];
            const shown = tasks.slice(0, MAX_CHIPS);
            const overflow = tasks.length - shown.length;
            const isSelected = iso === selectedDate;
            const isToday = iso === today;
            const outside = iso.slice(0, 7) !== monthAnchor.slice(0, 7);

            return (
              <div
                key={iso}
                className="flex min-w-0 flex-col items-center gap-1.5 px-px pt-1"
                style={{
                  height: ROW_PX,
                  opacity: outside ? 0.45 : isPastDate(iso) ? 0.75 : 1,
                }}
              >
                <button
                  type="button"
                  onClick={() => onDateChange(iso)}
                  aria-pressed={isSelected}
                  aria-current={isToday ? "date" : undefined}
                  className="relative flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-sm font-bold leading-none focus-visible:outline-none focus-visible:ring-2"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  {/* Shared layoutId: as the agenda scrolls the day under the fold changes and
                      this one pill slides across the strip instead of blinking between cells. */}
                  {isSelected ? (
                    reduceMotion ? (
                      <span
                        aria-hidden
                        className="absolute inset-0 rounded-full"
                        style={{ backgroundColor: "var(--color-progress)" }}
                      />
                    ) : (
                      <motion.span
                        aria-hidden
                        layoutId="plan-mobile-day-selected"
                        className="absolute inset-0 rounded-full"
                        style={{ backgroundColor: "var(--color-progress)" }}
                        transition={selectedPillTransition}
                      />
                    )
                  ) : null}
                  <span
                    className="relative z-10"
                    style={{
                      color: isSelected
                        ? "#fff"
                        : isToday
                          ? "var(--color-progress)"
                          : "var(--color-main)",
                    }}
                  >
                    {Number(iso.slice(8))}
                  </span>
                </button>

                <div className="flex w-full min-w-0 flex-col gap-px">
                  {shown.map((task) => {
                    const color = planEventColor(task.subject);
                    return (
                      <button
                        key={task.id}
                        type="button"
                        onClick={() => onOpenTask(task)}
                        className="w-full cursor-pointer truncate rounded-[3px] border-l-2 px-0.5 text-left text-[8px] leading-[1.35] focus-visible:outline-none focus-visible:ring-2"
                        style={{
                          backgroundColor: color.bg,
                          borderLeftColor: color.bar,
                          color: "var(--color-main)",
                          textDecoration:
                            task.status === "DONE" ? "line-through" : undefined,
                        }}
                      >
                        {task.title}
                      </button>
                    );
                  })}
                  {overflow > 0 ? (
                    <span
                      className="px-0.5 text-[8px] font-semibold leading-[1.35]"
                      style={{ color: "var(--color-accent)" }}
                    >
                      {t("calendar_more", { count: overflow })}
                    </span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Grab handle — dragged for the continuous reveal, tapped for the same thing at once. */}
      <button
        type="button"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={() => {
          if (!dragging) (expanded ? onCollapse : onExpand)();
        }}
        aria-expanded={expanded}
        aria-label={t(expanded ? "calendar_strip_collapse" : "calendar_strip_expand")}
        className="mx-auto flex min-h-11 w-28 cursor-grab touch-none items-center justify-center focus-visible:outline-none focus-visible:ring-2 active:cursor-grabbing"
      >
        <span
          aria-hidden
          className="h-1 w-10 rounded-full"
          style={{
            backgroundColor: "color-mix(in srgb, var(--color-main) 22%, transparent)",
          }}
        />
      </button>
    </div>
  );
}
