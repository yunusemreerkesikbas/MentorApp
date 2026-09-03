"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import type { StudyRoomTheme } from "@mentor/types";
import { SessionFocusBackdrop } from "./session-focus-backdrop";

export interface SessionFocusViewProps {
  groundTheme: StudyRoomTheme | null;
  themeDirection: 1 | -1;
  topBar: ReactNode;
  planTaskChip: ReactNode;
  phase: "focus" | "break";
  phaseLabel: string;
  timerRing: ReactNode;
  sessionControls: ReactNode;
  phaseMotion?: Record<string, unknown>;
}

/**
 * Full-screen immersive focus / break stage overlay.
 */
export function SessionFocusView({
  groundTheme,
  themeDirection,
  topBar,
  planTaskChip,
  phase,
  phaseLabel,
  timerRing,
  sessionControls,
  phaseMotion,
}: SessionFocusViewProps) {
  return (
    <div className="session-focus-theme fixed inset-0 z-30 flex flex-col items-center justify-center px-5 py-8">
      <SessionFocusBackdrop roomTheme={groundTheme} themeDirection={themeDirection} />
      {/* Top scenery bar anchored at the top edge */}
      <div className="absolute inset-x-0 top-0 z-10 mx-auto flex w-full max-w-2xl justify-center px-5 pt-5">
        {topBar}
      </div>
      <motion.div
        key={phase}
        className="relative flex w-full max-w-sm flex-col items-center gap-6"
        {...phaseMotion}
      >
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
        {timerRing}
        {sessionControls}
      </motion.div>
    </div>
  );
}
