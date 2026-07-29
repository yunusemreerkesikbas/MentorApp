"use client";

import type { PlanTaskDto } from "@mentor/types";
import type { CSSProperties } from "react";
import { planEventColor } from "@/lib/plan-event-colors";
import { formatTimeRange } from "./plan-utils";

/** Stage-light state driven by the subject legend: no highlight, under the light, or faded back. */
export type PlanEventSpotlight = "off" | "lit" | "dimmed";

/** Per-chip ramp-up step; capped so a busy month still finishes the sweep quickly. */
export const SPOTLIGHT_STEP_MS = 25;
export const SPOTLIGHT_MAX_DELAY_MS = 400;

export function spotlightDelay(litIndex: number): number {
  return Math.min(litIndex * SPOTLIGHT_STEP_MS, SPOTLIGHT_MAX_DELAY_MS);
}

export type PlanEventHoverHandler = (
  task: PlanTaskDto,
  anchor: HTMLElement | null,
) => void;

/**
 * One event on the calendar. Color comes from the subject (see plan-event-colors); the subject
 * name is always rendered too, so color is never the only carrier of meaning.
 *
 * Click opens the edit sheet. Hover/focus raises a read-only preview owned by the calendar
 * surface — ponytail: one shared popover instead of one per chip, and no interactive controls
 * inside it (the chip click already edits).
 */
export function PlanEventChip({
  task,
  variant,
  spotlight = "off",
  spotlightDelayMs = 0,
  style,
  onOpen,
  onHover,
}: {
  task: PlanTaskDto;
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
  onOpen: (task: PlanTaskDto) => void;
  onHover: PlanEventHoverHandler;
}) {
  const color = planEventColor(task.subject);
  const done = task.status === "DONE";
  const isBlock = variant === "block";
  const lit = spotlight === "lit";
  const dimmed = spotlight === "dimmed";

  return (
    <button
      type="button"
      onClick={() => onOpen(task)}
      onMouseEnter={(e) => onHover(task, e.currentTarget)}
      onMouseLeave={() => onHover(task, null)}
      onFocus={(e) => onHover(task, e.currentTarget)}
      onBlur={() => onHover(task, null)}
      className={`w-full cursor-pointer overflow-hidden rounded-[6px] border-l-2 text-left transition-[box-shadow,opacity,transform,filter] duration-[260ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:shadow-[var(--shadow-card)] focus-visible:outline-none focus-visible:ring-2 motion-reduce:transform-none motion-reduce:transition-[opacity] motion-reduce:duration-150 ${
        isBlock
          ? "absolute flex flex-col gap-0.5 px-1.5 py-1"
          : "block px-1.5 py-[3px]"
      }`}
      style={{
        backgroundColor: color.bg,
        borderLeftColor: color.bar,
        opacity: dimmed ? 0.32 : done ? 0.6 : 1,
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
            className={`block truncate text-[11px] font-semibold leading-tight ${done ? "line-through" : ""}`}
            style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
          >
            {task.title}
          </span>
          {formatTimeRange(task.startTime, task.endTime) || task.subject ? (
            <span
              className="block truncate text-[10px] leading-tight"
              style={{ color: "var(--color-secondary)" }}
            >
              {[formatTimeRange(task.startTime, task.endTime), task.subject]
                .filter(Boolean)
                .join(" · ")}
            </span>
          ) : null}
        </>
      ) : (
        // Month cell: one line. Position encodes nothing here, so the start time earns its space —
        // the subject does not (color + the hover preview already carry it).
        <span
          className={`block truncate text-[11px] leading-tight ${done ? "line-through" : ""}`}
          style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
        >
          {task.startTime ? (
            <span className="font-semibold tabular-nums">{task.startTime} </span>
          ) : null}
          {task.title}
        </span>
      )}
    </button>
  );
}
