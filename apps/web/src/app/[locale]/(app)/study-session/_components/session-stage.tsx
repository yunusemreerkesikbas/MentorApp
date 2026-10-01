"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { StudyRoomTheme } from "@mentor/types";
import { RoomBackdropSlide } from "./room-backdrop-slide";
import { SessionFocusBackdrop } from "./session-focus-backdrop";

export type SessionStagePhase = "idle" | "focus" | "break" | "done";

/** The room's veil per phase, as a share of the theme's own veil (`RoomBackdrop`'s contract). */
export const STAGE_ROOM_VEIL: Record<SessionStagePhase, number> = {
  idle: 58,
  focus: 86,
  break: 44,
  done: 74,
};
/** The house lights: veil, chrome cover and the plain theatre all take this long. */
const LIGHTS_MS = 500;
const LIGHTS_CLASS =
  "transition-opacity duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none";

/**
 * The one ground /seans stands on, from setup through focus, break and the done card, so that
 * starting a session is the lights going down rather than a page being swapped for another.
 *
 * Start: the room's veil thickens and the app chrome (sidebar, phone header and tab bar) goes
 * dark; on the plain view the dark theatre fades in instead. Break lifts the light and warms
 * it. Done dims it a little again, and back at setup the lights come up. Everything the phases
 * render sits on top: the idle page in flow, the focus layer fixed over the same box.
 *
 * While the lights are down the stage is raised over the app chrome, and it stays raised until
 * they are fully back up, or the sidebar would reappear before its cover has faded.
 */
export function SessionStage({
  phase,
  groundTheme,
  themeDirection,
  children,
}: {
  phase: SessionStagePhase;
  groundTheme: StudyRoomTheme | null;
  themeDirection: 1 | -1;
  children: ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  const dark = phase !== "idle";
  const [settled, setSettled] = useState(!dark);
  if (dark && settled) setSettled(false);
  useEffect(() => {
    if (dark || settled) return;
    const id = window.setTimeout(() => setSettled(true), reduceMotion ? 0 : LIGHTS_MS);
    return () => window.clearTimeout(id);
  }, [dark, settled, reduceMotion]);

  return (
    <div
      className={`relative isolate${settled ? "" : " z-30"}`}
      data-testid="session-stage"
      data-phase={phase}
      data-lights={dark ? "down" : "up"}
    >
      <div
        aria-hidden
        data-stage-cover
        className={`session-focus-theme pointer-events-none fixed inset-0 -z-20 bg-[var(--color-bg)] ${LIGHTS_CLASS}`}
        style={{ opacity: dark ? 0.94 : 0 }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 bottom-0 top-16 -z-10 overflow-hidden lg:left-[var(--app-sidebar-width)] lg:top-0"
      >
        {groundTheme ? (
          <RoomBackdropSlide
            theme={groundTheme}
            direction={themeDirection}
            veilPercent={STAGE_ROOM_VEIL[phase]}
          />
        ) : (
          <AnimatePresence>
            {dark ? (
              <motion.div
                key="theatre"
                className="session-focus-theme absolute inset-0"
                initial={reduceMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={reduceMotion ? undefined : { opacity: 0 }}
                transition={{ duration: LIGHTS_MS / 1000, ease: [0.22, 1, 0.36, 1] }}
              >
                <SessionFocusBackdrop />
              </motion.div>
            ) : null}
          </AnimatePresence>
        )}
        <div
          data-stage-warmth
          className={`session-break-warmth absolute inset-0 ${LIGHTS_CLASS}`}
          style={{ opacity: phase === "break" ? 0.4 : 0 }}
        />
      </div>
      {children}
    </div>
  );
}
