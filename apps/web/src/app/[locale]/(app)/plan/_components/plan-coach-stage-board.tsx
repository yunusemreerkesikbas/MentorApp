"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { planEventColor } from "@/lib/plan-event-colors";
import type { PlanWindowDay } from "./plan-coach-adaptation-brief-note";
import {
  STAGE_MAX_ROWS,
  type StageScene,
  type StageSlot,
} from "./plan-coach-stage-scene";

// The board's own geometry, in rem on the 4 px grid: a block on its edge, then a gap, six to a day.
const COLUMN_GAP = 0.5;
const BLOCK_INSET = 0.25;
const BLOCK_HEIGHT = 2.25;
const BLOCK_EDGE = 0.25;
const BLOCK_PITCH = BLOCK_HEIGHT + BLOCK_EDGE + 0.25;
const TRACK_PAD = 0.5;
const TRACK_HEIGHT = STAGE_MAX_ROWS * BLOCK_PITCH + TRACK_PAD * 2;

/**
 * The week being put together: seven day tracks and the blocks that keep changing places on them.
 * Decoration for the wait, so it is hidden from assistive tech; the blocks carry no labels and
 * never settle into something that could be read as the plan.
 */
export function PlanCoachStageBoard({
  days,
  scene,
  slots,
  arrived,
}: {
  days: readonly PlanWindowDay[];
  scene: StageScene;
  slots: readonly StageSlot[];
  /** The answer landed: the blocks gather and leave towards the preview. */
  arrived: boolean;
}) {
  const t = useTranslations("plan");
  const weekday = new Intl.DateTimeFormat(useLocale(), { weekday: "short" });
  // One frame late, so the blocks are dealt onto the board instead of appearing on it.
  const [dealt, setDealt] = useState(false);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setDealt(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  // Container units keep the blocks on their tracks at any width without measuring.
  const columns = scene.columns.length;
  const track = `(100cqw - ${(columns - 1) * COLUMN_GAP}rem) / ${columns}`;
  const blockWidth = `calc(${track} - ${BLOCK_INSET * 2}rem)`;
  const centre = `calc(50cqw - (${track} - ${BLOCK_INSET * 2}rem) / 2)`;

  return (
    <div aria-hidden className="@container relative">
      <div className="flex" style={{ gap: `${COLUMN_GAP}rem` }}>
        {days.map((day, index) => {
          const active = scene.columns[index]?.active ?? false;
          return (
            <div
              key={day.weekday}
              className="flex min-w-0 flex-1 flex-col items-center gap-2"
            >
              <span
                className={`whitespace-nowrap text-xs font-extrabold ${active ? "text-[var(--color-main)]" : "text-[var(--color-secondary)]"}`}
              >
                {index === 0
                  ? t("coach_adaptation_today")
                  : weekday.format(day.date)}
              </span>
              <span
                className={`block w-full rounded-[var(--play-radius)] border-2 ${active ? "border-transparent bg-[var(--play-track)]" : "border-dashed border-[var(--play-line)]"}`}
                style={{ height: `${TRACK_HEIGHT}rem` }}
              />
            </div>
          );
        })}
      </div>
      <div
        className="absolute inset-x-0 bottom-0"
        style={{ height: `${TRACK_HEIGHT}rem` }}
      >
        {scene.blocks.map((subject, index) => {
          const slot = slots[index]!;
          const colour = planEventColor(subject).bar;
          const placed = dealt && !arrived;
          const x = `calc(${slot.column} * (${track} + ${COLUMN_GAP}rem) + ${BLOCK_INSET}rem)`;
          const y =
            TRACK_HEIGHT -
            TRACK_PAD -
            BLOCK_EDGE -
            BLOCK_HEIGHT -
            slot.row * BLOCK_PITCH;
          return (
            <span
              key={index}
              className="absolute left-0 top-0 rounded-[var(--radius-card)] transition-[transform,opacity] motion-reduce:transition-none"
              style={{
                width: blockWidth,
                height: `${BLOCK_HEIGHT}rem`,
                background: colour,
                boxShadow: `0 ${BLOCK_EDGE}rem 0 color-mix(in srgb, ${colour} 70%, var(--play-cta-ink))`,
                opacity: placed ? 1 : 0,
                transform: placed
                  ? `translate(${x}, ${y}rem) scale(1)`
                  : arrived
                    ? `translate(${centre}, ${TRACK_HEIGHT + 2}rem) scale(0.5)`
                    : `translate(${centre}, -4rem) scale(0.4)`,
                transitionDuration:
                  "var(--duration-very-slow), var(--duration-fast)",
                transitionTimingFunction:
                  "var(--ease-smooth-out), var(--ease-out)",
                // Dealt one after another; gathered quicker, inside the arrival's budget.
                transitionDelay: arrived
                  ? `calc(var(--duration-stagger) * ${index} / 3)`
                  : `calc(var(--duration-stagger) * ${index % 4})`,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
