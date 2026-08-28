"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { StudyRoomTheme } from "@mentor/types";
import { RoomBackdrop } from "./room-backdrop";

/** Matches the theme carousel in the create sheet, so stepping a room feels the same everywhere. */
const SLIDE_MS = 380;

/**
 * The room's ground, changing themes by sliding rather than dissolving.
 *
 * A crossfade says "this picture was replaced". A slide says "you turned to look at the next
 * room" — which is what the arrows actually mean, and it is already how the theme carousel in
 * the create sheet behaves. Direction comes from the control that caused the change, so
 * "next" always travels the same way, wrapping from HOME back to LIBRARY included.
 *
 * `prefers-reduced-motion` falls back to a crossfade: the change still has to be visible, it
 * just stops travelling.
 */
export function RoomBackdropSlide({
  theme,
  /** +1 when stepping forward, -1 back. Anything else (a poll, a first paint) reuses the last. */
  direction,
  veilPercent,
}: {
  theme: StudyRoomTheme;
  direction: 1 | -1;
  veilPercent?: number;
}) {
  const reduceMotion = useReducedMotion();
  const enterX = direction > 0 ? "100%" : "-100%";
  const exitX = direction > 0 ? "-100%" : "100%";

  return (
    // `initial={false}` so arriving at a room does not slide the ground in from nowhere — the
    // first theme is simply where you are; only a CHANGE travels.
    <AnimatePresence initial={false}>
      <motion.div
        key={theme}
        className="absolute inset-0"
        initial={reduceMotion ? { opacity: 0 } : { x: enterX }}
        animate={{ x: 0, opacity: 1 }}
        exit={reduceMotion ? { opacity: 0 } : { x: exitX }}
        transition={{
          duration: reduceMotion ? 0.12 : SLIDE_MS / 1000,
          ease: [0.22, 1, 0.36, 1],
        }}
      >
        <RoomBackdrop theme={theme} veilPercent={veilPercent} />
      </motion.div>
    </AnimatePresence>
  );
}
