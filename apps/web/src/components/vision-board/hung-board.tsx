"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  animate,
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  type MotionValue,
} from "framer-motion";
import type { VisionBoardDoc } from "@mentor/types";
import { BoardFrame } from "./board-frame";
import { BoardStage } from "./board-stage";
import { SWAY_KICK, SWAY_SPRING, hoverKick, takeBoardHung } from "./hung-board-sway";

export interface BoardSway {
  rotate: MotionValue<number>;
  /** Push the board; it swings about its nail and comes to rest. Degrees per second. */
  nudge: (velocity: number) => void;
}

/** Owned by whoever also has a reason to push the board (the card pushes it when its preview shuts). */
export function useBoardSway(): BoardSway {
  const reduceMotion = useReducedMotion();
  const rotate = useMotionValue(0);
  const nudge = useCallback(
    (velocity: number) => {
      if (reduceMotion) return;
      animate(rotate, 0, { ...SWAY_SPRING, velocity });
    },
    [reduceMotion, rotate],
  );
  return useMemo(() => ({ rotate, nudge }), [rotate, nudge]);
}

/**
 * The board as the phone wallpaper shows it: framed, on the wall, hung from a nail by a cord.
 * The numbers are `wallpaperLayout`'s, restated against the board's width (the SVG spans it): the
 * cord meets the board 19% in from each side and the nail sits 17.7% of that width above it. The
 * wall is the editor's and follows the theme; the cord and nail are objects, like the wood frame,
 * and keep the wallpaper's colours.
 *
 * It sways (DESIGN.md §9.1): once when a board that has just been saved is first seen, and when a
 * mouse comes in over it. The SVG's box starts at the nail's centre so that the top edge of what
 * rotates is the pivot.
 */
export function HungBoard({ doc, sway }: { doc: VisionBoardDoc; sway: BoardSway }) {
  const wallRef = useRef<HTMLSpanElement>(null);
  const seen = useInView(wallRef, { once: true, amount: 0.6 });
  const { nudge } = sway;

  useEffect(() => {
    if (seen && takeBoardHung()) nudge(SWAY_KICK.arrival);
  }, [seen, nudge]);

  return (
    <span
      ref={wallRef}
      onPointerEnter={(event) => {
        if (event.pointerType !== "mouse") return;
        nudge(hoverKick(event.clientX, event.currentTarget.getBoundingClientRect()));
      }}
      className="block overflow-hidden rounded-[var(--radius-card)] bg-[var(--color-surface-container)] px-[7%] pb-[9%] pt-[5%]"
    >
      <motion.span
        data-testid="hung-board-swing"
        className="block"
        style={{ rotate: sway.rotate, transformOrigin: "50% 0%" }}
      >
        <svg viewBox="0 1.5 100 17.5" aria-hidden className="block w-full overflow-visible">
          <path
            d="M19 20 L50 1.5 L81 20"
            fill="none"
            stroke="#8a6a45"
            strokeWidth="0.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="50" cy="1.5" r="1.35" fill="#9a7440" />
        </svg>
        <span className="relative block shadow-[var(--shadow-card)]">
          <BoardFrame frame={doc.frame}>
            <BoardStage doc={doc} />
          </BoardFrame>
        </span>
      </motion.span>
    </span>
  );
}
