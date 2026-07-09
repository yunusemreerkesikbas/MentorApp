"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { SessionPresetDto } from "@mentor/types";
import { Chip, CircularTimerRing } from "@mentor/ui";

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
    <div className="flex w-full flex-col items-center gap-5">
      <CircularTimerRing
        mode={isCountdown ? "countdown" : "setup"}
        minutes={referenceMinutes}
        secondsLeft={secondsLeft}
        disabled={!isIdle}
        onMinutesChange={isIdle ? onMinutesChange : undefined}
        size={280}
      />

      {isIdle && (
        <div
          className="flex flex-wrap justify-center gap-2"
          role="group"
          aria-label="Preset"
        >
          {presets.map((p) => (
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
              className="cursor-pointer focus-visible:outline-none focus-visible:ring-2"
              aria-pressed={selectedPresetId === p.id}
              whileTap={reduceMotion ? undefined : { scale: 0.97 }}
            >
              <Chip
                className={
                  selectedPresetId === p.id
                    ? "ring-2 ring-[var(--color-main)] ring-offset-1"
                    : ""
                }
              >
                {p.label}
              </Chip>
            </motion.button>
          ))}
        </div>
      )}
    </div>
  );
}
