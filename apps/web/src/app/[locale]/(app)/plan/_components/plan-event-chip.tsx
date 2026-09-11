"use client";

import { CalendarDays, ListTodo } from "lucide-react";
import type { CSSProperties } from "react";
import type { PlanCalendarItem } from "@/lib/plan-calendar-item";
import { formatTimeRange } from "./plan-utils";

/** Stage-light state driven by the subject legend: no highlight, under the light, or faded back. */
export type PlanEventSpotlight = "off" | "lit" | "dimmed";

/** Per-chip ramp-up step; capped so a busy month still finishes the sweep quickly. */
export const SPOTLIGHT_STEP_MS = 25;
export const SPOTLIGHT_MAX_DELAY_MS = 400;

export function spotlightDelay(litIndex: number): number {
  return Math.min(litIndex * SPOTLIGHT_STEP_MS, SPOTLIGHT_MAX_DELAY_MS);
}

export type PlanEventHoverHandler<T> = (
  item: PlanCalendarItem<T>,
  anchor: HTMLElement | null,
) => void;

/**
 * One item on the calendar. Color is resolved by the adapter (see plan-calendar-item), never here,
 * and the chip always renders a text carrier next to it, so color is never the only carrier of
 * meaning.
 *
 * Click opens the details. Hover/focus raises a read-only preview owned by the calendar
 * surface — ponytail: one shared popover instead of one per chip, and no interactive controls
 * inside it (the chip click already opens the detail).
 */
export function PlanEventChip<T>({
  item,
  variant,
  spotlight = "off",
  spotlightDelayMs = 0,
  style,
  onOpen,
  onHover,
}: {
  item: PlanCalendarItem<T>;
  /** "month" = single compact line; "block" = positioned block in the hour grid. */
  variant: "month" | "block";
  /**
   * Legend highlight state. `dimmed` drops the stage light, `lit` raises this chip back up —
   * the board reads as one scene rather than a set of independently toggled items.
   */
  spotlight?: PlanEventSpotlight;
  /** Staggered ramp-up so lit chips come on in reading order instead of all at once. */
  spotlightDelayMs?: number;
  style?: CSSProperties;
  onOpen: (source: T, trigger: HTMLButtonElement) => void;
  onHover: PlanEventHoverHandler<T>;
}) {
  const { color } = item;
  const isBlock = variant === "block";
  const lit = spotlight === "lit";
  const dimmed = spotlight === "dimmed";
  const range = formatTimeRange(item.startTime, item.endTime);
  const glyph =
    item.glyph === "task" ? (
      <ListTodo size={11} strokeWidth={2.25} aria-hidden className="shrink-0" />
    ) : item.glyph === "event" ? (
      <CalendarDays size={11} strokeWidth={2.25} aria-hidden className="shrink-0" />
    ) : (
      item.icon
    );

  return (
    <button
      type="button"
      onClick={(e) => onOpen(item.source, e.currentTarget)}
      onMouseEnter={(e) => onHover(item, e.currentTarget)}
      onMouseLeave={() => onHover(item, null)}
      onFocus={(e) => onHover(item, e.currentTarget)}
      onBlur={() => onHover(item, null)}
      className={`w-full cursor-pointer overflow-hidden rounded-[6px] border-l-2 text-left transition-[box-shadow,opacity,transform,filter] duration-[260ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:shadow-[var(--shadow-card)] focus-visible:outline-none focus-visible:ring-2 motion-reduce:transform-none motion-reduce:transition-[opacity] motion-reduce:duration-150 ${
        isBlock
          ? "absolute flex flex-col gap-0.5 px-1.5 py-1"
          : "block px-1.5 py-[3px]"
      }`}
      style={{
        backgroundColor: color.bg,
        borderLeftColor: color.bar,
        opacity: dimmed ? 0.32 : item.muted ? 0.6 : 1,
        // Desaturating the unlit chips is what makes the lit ones read as "under the light";
        // opacity alone leaves every colour still competing for attention.
        filter: dimmed ? "saturate(0.35)" : undefined,
        transform: lit ? "translateY(-2px)" : undefined,
        boxShadow: lit
          ? `0 0 0 1px ${color.bar}, 0 6px 14px color-mix(in srgb, ${color.bar} 38%, transparent)`
          : undefined,
        // Only the ramp-up staggers; dropping the lights is instant so clearing feels immediate.
        transitionDelay: lit ? `${spotlightDelayMs}ms` : undefined,
        ...style,
      }}
    >
      {isBlock ? (
        <>
          <span
            className={`flex min-w-0 items-center gap-1 text-[11px] font-semibold leading-tight ${item.muted ? "line-through" : ""}`}
            style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
          >
            {glyph}
            <span className="min-w-0 truncate">{item.title}</span>
          </span>
          {range || item.meta ? (
            <span
              className="block truncate text-[10px] leading-tight"
              style={{ color: "var(--color-secondary)" }}
            >
              {[range, item.meta].filter(Boolean).join(" · ")}
            </span>
          ) : null}
          {item.accessory}
        </>
      ) : (
        // Month cell: one line. Position encodes nothing here, so the start time earns its space —
        // the meta does not (color + the hover preview already carry it).
        <span
          className={`flex min-w-0 items-center gap-1 text-[11px] leading-tight ${item.muted ? "line-through" : ""}`}
          style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
        >
          {glyph}
          <span className="min-w-0 truncate">
            {item.startTime ? (
              <span className="font-semibold tabular-nums">{item.startTime} </span>
            ) : null}
            {item.title}
          </span>
        </span>
      )}
    </button>
  );
}
