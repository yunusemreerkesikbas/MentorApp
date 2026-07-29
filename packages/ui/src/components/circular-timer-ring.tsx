"use client";

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

const RING_STROKE = 8;
const HANDLE_RADIUS = 12;

/**
 * Circular focus timer (DESIGN.md progress tokens: track #C3D9FD, fill #55ACEE).
 * Setup: drag/touch/keyboard to pick duration. Countdown: read-only progress ring.
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

  const radius = (size - RING_STROKE) / 2 - HANDLE_RADIUS;
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
        className={`relative select-none ${interactive ? "cursor-grab touch-none active:cursor-grabbing" : ""}`}
        style={{ width: size, height: size }}
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
            r={radius - RING_STROKE / 2}
            fill={`url(#${labelId}-fill)`}
            className={
              mode === "countdown" ? "mentor-timer-breathe" : undefined
            }
          />
          <circle
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke="var(--color-progress-track)"
            strokeWidth={RING_STROKE}
          />
          <circle
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke="var(--color-progress)"
            strokeWidth={RING_STROKE}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            transform={`rotate(-90 ${cx} ${cy})`}
            className="motion-reduce:transition-none transition-[stroke-dashoffset] duration-1000 ease-linear"
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

      {interactive && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label={`${step} dakika azalt`}
            className="flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-full border border-white bg-white/70 text-xl font-bold transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none"
            style={{
              color: "var(--color-main)",
              boxShadow: "var(--shadow-card)",
            }}
            onClick={() => nudge(-step)}
          >
            −
          </button>
          <button
            type="button"
            aria-label={`${step} dakika artır`}
            className="flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-full border border-white bg-white/70 text-xl font-bold transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none"
            style={{
              color: "var(--color-main)",
              boxShadow: "var(--shadow-card)",
            }}
            onClick={() => nudge(step)}
          >
            +
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
} from "./circular-timer-ring.utils.js";
