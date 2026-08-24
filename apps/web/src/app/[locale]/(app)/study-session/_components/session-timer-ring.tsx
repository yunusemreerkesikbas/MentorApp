"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { SessionPresetDto } from "@mentor/types";
import { CircularTimerRing } from "@mentor/ui";

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
                className="min-h-11 cursor-pointer rounded-full px-4 text-sm font-semibold transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none"
                aria-pressed={selected}
                whileTap={reduceMotion ? undefined : { scale: 0.97 }}
                style={{
                  fontFamily: "var(--font-body)",
                  backgroundColor: selected
                    ? "var(--color-btn)"
                    : "var(--color-surface)",
                  color: selected
                    ? "var(--color-btn-label)"
                    : "var(--color-main)",
                  border: selected
                    ? "1px solid var(--color-btn)"
                    : "1px solid var(--color-border)",
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
