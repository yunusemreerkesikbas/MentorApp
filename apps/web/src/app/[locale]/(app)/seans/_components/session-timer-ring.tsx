"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { SessionPresetDto } from "@mentor/types";
import { Chip, CircularTimerRing } from "@mentor/ui";

export interface SessionTimerRingProps {
  phase: "idle" | "focus" | "done";
  focusMinutes: number;
  secondsLeft: number;
  presets: SessionPresetDto[];
  selectedPresetId: string | null;
  onMinutesChange: (minutes: number) => void;
  onPresetSelect: (presetId: "25_5" | "50_10", minutes: number) => void;
}

export function SessionTimerRing({
  phase,
  focusMinutes,
  secondsLeft,
  presets,
  selectedPresetId,
  onMinutesChange,
  onPresetSelect,
}: SessionTimerRingProps) {
  const reduceMotion = useReducedMotion();
  const isIdle = phase === "idle";
  const isFocus = phase === "focus";

  return (
    <div className="flex w-full flex-col items-center gap-6">
      <CircularTimerRing
        mode={isFocus ? "countdown" : "setup"}
        minutes={focusMinutes}
        secondsLeft={secondsLeft}
        disabled={!isIdle}
        onMinutesChange={isIdle ? onMinutesChange : undefined}
        size={300}
      />

      {isIdle && (
        <div className="flex flex-wrap justify-center gap-2">
          {presets.map((p) => (
            <motion.button
              key={p.id}
              type="button"
              onClick={() => onPresetSelect(p.id as "25_5" | "50_10", p.focusMinutes)}
              className="cursor-pointer focus-visible:outline-none focus-visible:ring-2"
              whileTap={reduceMotion ? undefined : { scale: 0.97 }}
            >
              <Chip
                className={
                  selectedPresetId === p.id ? "ring-2 ring-[var(--color-main)] ring-offset-1" : ""
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
