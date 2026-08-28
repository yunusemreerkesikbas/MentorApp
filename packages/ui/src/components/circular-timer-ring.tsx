"use client";

import { Minus, Plus } from "lucide-react";
import type * as React from "react";
import { useCallback, useId, useRef } from "react";
import {
  angleFromMinutes,
  angleFromPointer,
  clampMinutes,
  DEFAULT_TIMER_MAX,
  DEFAULT_TIMER_MIN,
  DEFAULT_TIMER_STEP,
  formatCountdown,
  minutesFromAngle,
  TIMER_TICK_COUNT,
  timerTickLine,
} from "./circular-timer-ring.utils.js";

export type CircularTimerRingMode = "setup" | "countdown";

export interface CircularTimerRingProps {
  mode: CircularTimerRingMode;
  /** Focus duration in minutes (setup) or total session minutes (countdown reference). */
  minutes: number;
  /** Remaining seconds — required in countdown mode. */
  secondsLeft?: number;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  onMinutesChange?: (minutes: number) => void;
  className?: string;
  /** Visual size in px (ring diameter). */
  size?: number;
}

const RING_STROKE_SETUP = 8;
const RING_STROKE_COUNTDOWN = 10;
const HANDLE_RADIUS = 12;

/**
 * Circular focus timer (DESIGN.md progress tokens: track #C3D9FD, fill #55ACEE).
 * Setup: drag/touch/keyboard to pick duration (ticks + progress like countdown).
 * Countdown: read-only progress ring.
 */
export function CircularTimerRing({
  mode,
  minutes,
  secondsLeft = 0,
  min = DEFAULT_TIMER_MIN,
  max = DEFAULT_TIMER_MAX,
  step = DEFAULT_TIMER_STEP,
  disabled = false,
  onMinutesChange,
  className,
  size = 280,
}: CircularTimerRingProps) {
  const labelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const ringStroke =
    mode === "countdown" ? RING_STROKE_COUNTDOWN : RING_STROKE_SETUP;

  const radius = (size - ringStroke) / 2 - HANDLE_RADIUS;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * radius;

  const progress =
    mode === "countdown" && minutes > 0
      ? secondsLeft / (minutes * 60)
      : (minutes - min) / (max - min);

  const dashOffset = circumference * (1 - Math.min(1, Math.max(0, progress)));
  const displayAngle =
    mode === "countdown" ? progress * 360 : angleFromMinutes(minutes, min, max);
  const handleRad = ((displayAngle - 90) * Math.PI) / 180;
  const handleX = cx + radius * Math.cos(handleRad);
  const handleY = cy + radius * Math.sin(handleRad);

  const interactive = mode === "setup" && !disabled;

  const applyPointer = useCallback(
    (clientX: number, clientY: number) => {
      if (!interactive || !rootRef.current || !onMinutesChange) return;
      const rect = rootRef.current.getBoundingClientRect();
      const angle = angleFromPointer(clientX, clientY, rect);
      onMinutesChange(minutesFromAngle(angle, min, max, step));
    },
    [interactive, min, max, step, onMinutesChange],
  );

  const onPointerDown = (e: React.PointerEvent) => {
    if (!interactive) return;
    draggingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    applyPointer(e.clientX, e.clientY);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    applyPointer(e.clientX, e.clientY);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    draggingRef.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const nudge = (delta: number) => {
    if (!onMinutesChange) return;
    onMinutesChange(clampMinutes(minutes + delta, min, max, step));
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!interactive || !onMinutesChange) return;
    switch (e.key) {
      case "ArrowUp":
      case "ArrowRight":
        e.preventDefault();
        nudge(step);
        break;
      case "ArrowDown":
      case "ArrowLeft":
        e.preventDefault();
        nudge(-step);
        break;
      case "Home":
        e.preventDefault();
        onMinutesChange(min);
        break;
      case "End":
        e.preventDefault();
        onMinutesChange(max);
        break;
      default:
        break;
    }
  };

  const centerPrimary =
    mode === "countdown" ? formatCountdown(secondsLeft) : String(minutes);
  const centerSecondary = mode === "countdown" ? "kaldı" : "dk";

  return (
    <div className={`flex flex-col items-center gap-3 ${className ?? ""}`}>
      <div
        ref={rootRef}
        className={`relative select-none rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] ${interactive ? "cursor-grab touch-none active:cursor-grabbing" : ""}`}
        style={{ width: size, height: size, WebkitTapHighlightColor: "transparent" }}
        role={interactive ? "slider" : undefined}
        aria-label={interactive ? "Odak süresi" : undefined}
        aria-labelledby={interactive ? labelId : undefined}
        aria-valuemin={interactive ? min : undefined}
        aria-valuemax={interactive ? max : undefined}
        aria-valuenow={interactive ? minutes : undefined}
        aria-valuetext={interactive ? `${minutes} dakika` : undefined}
        aria-readonly={!interactive || undefined}
        tabIndex={interactive ? 0 : -1}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <svg width={size} height={size} aria-hidden="true" className="block">
          <defs>
            <radialGradient id={`${labelId}-fill`} cx="50%" cy="38%" r="65%">
              <stop
                offset="0%"
                stopColor="var(--color-progress-track)"
                stopOpacity={0.55}
              />
              <stop
                offset="100%"
                stopColor="var(--color-progress)"
                stopOpacity={0.14}
              />
            </radialGradient>
          </defs>
          <circle
            cx={cx}
            cy={cy}
            r={radius - ringStroke / 2}
            fill={`url(#${labelId}-fill)`}
            className={
              mode === "countdown" ? "mentor-timer-breathe" : undefined
            }
          />
          {Array.from({ length: TIMER_TICK_COUNT }, (_, index) => {
            const tick = timerTickLine(index, cx, cy, radius);
            return (
              <line
                key={index}
                x1={tick.x1}
                y1={tick.y1}
                x2={tick.x2}
                y2={tick.y2}
                stroke="var(--color-main)"
                strokeOpacity={tick.major ? 0.45 : 0.22}
                strokeWidth={tick.major ? 2 : 1}
                strokeLinecap="round"
              />
            );
          })}
          <circle
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke="var(--color-progress-track)"
            strokeWidth={ringStroke}
          />
          <circle
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke="var(--color-progress)"
            strokeWidth={ringStroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            transform={`rotate(-90 ${cx} ${cy})`}
            className="motion-reduce:transition-none transition-[stroke-dashoffset] duration-1000 ease-linear"
            style={{
              filter:
                "drop-shadow(0 0 6px color-mix(in srgb, var(--color-progress) 55%, transparent))",
            }}
          />
          {mode === "countdown" && (
            <circle
              cx={handleX}
              cy={handleY}
              r={7}
              fill="var(--color-progress)"
              stroke="#FFFFFF"
              strokeWidth={2}
              className="motion-reduce:transition-none transition-[cx,cy] duration-1000 ease-linear"
              style={{
                filter:
                  "drop-shadow(0 0 6px color-mix(in srgb, var(--color-progress) 70%, transparent))",
              }}
            />
          )}
          {interactive && (
            <circle
              cx={handleX}
              cy={handleY}
              r={HANDLE_RADIUS}
              fill="var(--color-main)"
              stroke="#FFFFFF"
              strokeWidth={3}
              className="pointer-events-none"
            />
          )}
        </svg>
        <div
          className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"
          aria-live={mode === "countdown" ? "polite" : undefined}
        >
          <span
            id={labelId}
            className="text-5xl font-bold tabular-nums sm:text-6xl"
            style={{
              color: "var(--color-main)",
              fontFamily: "var(--font-heading)",
            }}
          >
            {centerPrimary}
          </span>
          <span
            className="text-sm font-semibold uppercase tracking-wide"
            style={{
              color: "var(--color-secondary)",
              fontFamily: "var(--font-heading)",
            }}
          >
            {centerSecondary}
          </span>
        </div>
      </div>

      {/*
        The ring is a drag target; these are the precise, non-drag way to the same number —
        and the only one that works without a pointer you can swing accurately. Removing them
        would make the minutes drag-only, which is not an operable control for everyone.

        Glyphs, not characters. `−` (U+2212) and `+` sit on different vertical metrics and
        inherit `text-xl`'s line box, so a text button centres one of them and never both —
        that visible half-pixel drift was the icons looking "off" inside the circles. An SVG
        pair is centred by its own viewBox and matches the stroke weight of every other icon
        in the app.
      */}
      {interactive && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label={`${step} dakika azalt`}
            className="flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-full transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none"
            style={{
              color: "var(--color-main)",
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              boxShadow: "var(--shadow-card)",
            }}
            onClick={() => nudge(-step)}
          >
            <Minus className="size-5" strokeWidth={2.5} aria-hidden />
          </button>
          <button
            type="button"
            aria-label={`${step} dakika artır`}
            className="flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-full transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none"
            style={{
              color: "var(--color-main)",
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              boxShadow: "var(--shadow-card)",
            }}
            onClick={() => nudge(step)}
          >
            <Plus className="size-5" strokeWidth={2.5} aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
}

export {
  angleFromMinutes,
  angleFromPointer,
  clampMinutes,
  formatCountdown,
  minutesFromAngle,
  timerTickLine,
  TIMER_TICK_COUNT,
} from "./circular-timer-ring.utils.js";
