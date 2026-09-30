"use client";

import { useLayoutEffect, useRef, type CSSProperties } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import type { SessionPresetDto } from "@mentor/types";
import { CircularTimerRing } from "@mentor/ui";

/** Visual diameter of the session ring; focus ripples scale from this. */
export const SESSION_TIMER_RING_PX = 280;
const RING_FLIGHT_MS = 450;

export type RingCenter = { x: number; y: number };

/** The ring sits at the top of its box, centred across it. */
function ringCenter(box: Element): RingCenter {
  const r = box.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + SESSION_TIMER_RING_PX / 2 };
}

/** Where the setup ring is on screen, read on Start so the running ring can fly from there. */
export function measureIdleRing(): RingCenter | null {
  const box = document.querySelector("[data-session-ring]");
  return box ? ringCenter(box) : null;
}

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
  /** Set when Start was pressed on the setup screen: the running ring flies in from there. */
  flyFrom?: RingCenter | null;
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
  flyFrom = null,
}: SessionTimerRingProps) {
  const t = useTranslations("session");
  const reduceMotion = useReducedMotion();
  const isIdle = phase === "idle";
  const isBreak = phase === "break";
  const isCountdown = phase === "focus" || phase === "break";
  const referenceMinutes = isBreak ? breakMinutes : focusMinutes;

  // The ring is the one thing that carries over from setup to focus, so it travels rather than
  // being swapped (FLIP): drawn where it will live, then played back from where it was.
  const ringRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const box = ringRef.current;
    if (!flyFrom || !box || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const to = ringCenter(box);
    box.animate(
      [{ transform: `translate(${flyFrom.x - to.x}px, ${flyFrom.y - to.y}px)` }, { transform: "none" }],
      { duration: RING_FLIGHT_MS, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
    );
  }, [flyFrom]);

  return (
    <div
      className="flex w-full flex-col items-center gap-5"
      style={
        { "--session-ring-size": `${SESSION_TIMER_RING_PX}px` } as CSSProperties
      }
    >
      <div
        ref={ringRef}
        data-session-ring
        data-phase={phase}
        // The setup ring hides in the very frame the lights go down (the stage's `data-lights`),
        // while the setup screen around it recedes: the running ring is already on top of it,
        // on its way to the centre, and two rings must not show at once.
        className={`session-ring relative flex w-full flex-col items-center${
          isIdle ? " [[data-lights=down]_&]:invisible" : ""
        }`}
      >
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
          aria-label={t("preset_group")}
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
