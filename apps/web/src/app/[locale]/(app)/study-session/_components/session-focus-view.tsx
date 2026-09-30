"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { StudyRoomTheme } from "@mentor/types";

export interface SessionFocusViewProps {
  groundTheme: StudyRoomTheme | null;
  topBar: ReactNode;
  planTaskChip: ReactNode;
  phaseLabel: string;
  timerRing: ReactNode;
  sessionControls: ReactNode;
}

/**
 * The running session over `SessionStage`'s ground, laid over the same box so the room does not
 * move when the lights go down. The ring is not faded in: it flies here from the setup screen
 * (`SessionTimerRing`), and the words and controls follow it once it is on its way. Break
 * changes the light and the ring's colour, not this layout, so nothing re-enters.
 */
export function SessionFocusView({
  groundTheme,
  topBar,
  planTaskChip,
  phaseLabel,
  timerRing,
  sessionControls,
}: SessionFocusViewProps) {
  const reduceMotion = useReducedMotion();
  const follow = reduceMotion
    ? {}
    : {
        initial: { opacity: 0 },
        animate: { opacity: 1, transition: { duration: 0.25, delay: 0.15, ease: "easeOut" as const } },
      };

  return (
    <div
      className={`session-focus-theme fixed inset-x-0 bottom-0 top-16 z-10 flex flex-col items-center justify-center px-5 py-8 lg:left-[var(--app-sidebar-width)] lg:top-0${
        groundTheme ? " room-stage" : ""
      }`}
      data-room-theme={groundTheme ?? undefined}
    >
      <motion.div
        className="absolute inset-x-0 top-0 z-10 mx-auto flex w-full max-w-2xl justify-center px-5 pt-5"
        {...follow}
      >
        {topBar}
      </motion.div>
      <div className="relative flex w-full max-w-sm flex-col items-center gap-6">
        <motion.div className="flex flex-col items-center gap-6" {...follow}>
          {planTaskChip}
          <p
            className="text-sm font-semibold uppercase tracking-wide"
            style={{
              color: "var(--color-secondary)",
              fontFamily: "var(--font-heading)",
            }}
          >
            {phaseLabel}
          </p>
        </motion.div>
        {timerRing}
        <motion.div {...follow}>{sessionControls}</motion.div>
      </div>
    </div>
  );
}
