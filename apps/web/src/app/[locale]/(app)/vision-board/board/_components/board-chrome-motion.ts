import type { Transition } from "framer-motion";

/** Chrome-layer motion for the collage editor (DESIGN.md §9 — 150–250ms, ease-out). */
export const BOARD_CHROME_EASE = [0.22, 1, 0.36, 1] as const;

export const boardChromeTransition: Transition = {
  duration: 0.2,
  ease: BOARD_CHROME_EASE,
};

export const boardChromeFastTransition: Transition = {
  duration: 0.15,
  ease: BOARD_CHROME_EASE,
};
