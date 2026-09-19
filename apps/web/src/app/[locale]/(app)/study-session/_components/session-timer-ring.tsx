"use client";

import type { CSSProperties } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { SessionPresetDto } from "@mentor/types";
import { CircularTimerRing } from "@mentor/ui";

/** Visual diameter of the session ring; focus ripples scale from this. */
export const SESSION_TIMER_RING_PX = 280;

export interface SessionTimerRingProps {
  phase: "idle" | "focus" | "break" | "done";
  focusMinutes: number;
  breakMinutes: number;
  secondsLeft: number;
  presets: SessionPresetDto[];
  selectedPresetId: string | null;
  onMinutesChange: (minutes: number) => void;
  onPresetSelect: (
    presetId: "25_5" | "50_10",
    minutes: number,
    breakMinutes: number,
  ) => void;
}

export function SessionTimerRing({
  phase,
  focusMinutes,
  breakMinutes,
  secondsLeft,
  presets,
  selectedPresetId,
  onMinutesChange,
  onPresetSelect,
}: SessionTimerRingProps) {
  const reduceMotion = useReducedMotion();
  const isIdle = phase === "idle";
  const isBreak = phase === "break";
  const isCountdown = phase === "focus" || phase === "break";
  const referenceMinutes = isBreak ? breakMinutes : focusMinutes;

  return (
    <div
      className="flex w-full flex-col items-center gap-5"
      style={
        { "--session-ring-size": `${SESSION_TIMER_RING_PX}px` } as CSSProperties
      }
    >
      <div className="relative flex w-full flex-col items-center">
        {isCountdown ? (
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-0 z-0 grid -translate-x-1/2 place-items-center overflow-visible"
            style={{
              width: SESSION_TIMER_RING_PX,
              height: SESSION_TIMER_RING_PX,
            }}
          >
            <span className="session-focus-ripple session-focus-ripple-1" />
            <span className="session-focus-ripple session-focus-ripple-2" />
            <span className="session-focus-ripple session-focus-ripple-3" />
          </div>
        ) : null}
        <CircularTimerRing
          className="relative z-[1]"
          mode={isCountdown ? "countdown" : "setup"}
          minutes={referenceMinutes}
          secondsLeft={secondsLeft}
          disabled={!isIdle}
          onMinutesChange={isIdle ? onMinutesChange : undefined}
          size={SESSION_TIMER_RING_PX}
        />
      </div>

      {isIdle && (
        <div
          className="flex flex-wrap justify-center gap-2"
          role="group"
          aria-label="Preset"
        >
          {presets.map((p) => {
            const selected = selectedPresetId === p.id;
            return (
              <motion.button
                key={p.id}
                type="button"
                onClick={() =>
                  onPresetSelect(
                    p.id as "25_5" | "50_10",
                    p.focusMinutes,
                    p.breakMinutes,
                  )
                }
                className={`min-h-11 cursor-pointer rounded-full px-5 text-sm font-bold transition-all duration-150 hover:scale-[1.03] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none motion-reduce:hover:scale-100 ${
                  selected ? "session-liquid-btn-obsidian" : "session-liquid-pill"
                }`}
                aria-pressed={selected}
                whileTap={reduceMotion ? undefined : { scale: 0.97 }}
                style={{
                  fontFamily: "var(--font-body)",
                }}
              >
                {p.label}
              </motion.button>
            );
          })}
        </div>
      )}
    </div>
  );
}
