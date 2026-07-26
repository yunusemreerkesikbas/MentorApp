"use client";

import type { PlanTaskDto } from "@mentor/types";
import type { CSSProperties } from "react";
import { planEventColor } from "@/lib/plan-event-colors";
import { formatTimeRange } from "./plan-utils";

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
  style,
  onOpen,
  onHover,
}: {
  task: PlanTaskDto;
  /** "month" = single compact line; "block" = positioned block in the hour grid. */
  variant: "month" | "block";
  style?: CSSProperties;
  onOpen: (task: PlanTaskDto) => void;
  onHover: PlanEventHoverHandler;
}) {
  const color = planEventColor(task.subject);
  const done = task.status === "DONE";
  const isBlock = variant === "block";

  return (
    <button
      type="button"
      onClick={() => onOpen(task)}
      onMouseEnter={(e) => onHover(task, e.currentTarget)}
      onMouseLeave={() => onHover(task, null)}
      onFocus={(e) => onHover(task, e.currentTarget)}
      onBlur={() => onHover(task, null)}
      className={`w-full cursor-pointer overflow-hidden rounded-[6px] border-l-2 text-left transition-shadow hover:shadow-[var(--shadow-card)] focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none ${
        isBlock
          ? "absolute flex flex-col gap-0.5 px-1.5 py-1"
          : "block px-1.5 py-[3px]"
      }`}
      style={{
        backgroundColor: color.bg,
        borderLeftColor: color.bar,
        opacity: done ? 0.6 : 1,
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
