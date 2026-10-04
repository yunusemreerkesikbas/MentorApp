"use client";

import { useCallback, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { SuccessCheck } from "@mentor/ui";
import { COACH_SUCCESS_MS } from "./coach-motion";

const CHECK_PATH = "M5 12.5l4.5 4.5L19 7.5";

/**
 * The success moment (Durak F): `play()` shows the ✓ for `COACH_SUCCESS_MS`, then resolves so the
 * caller can close its panel or switch its mode. Under reduced motion it resolves at once and
 * nothing waits.
 */
export function useSuccessMoment() {
  const reduceMotion = useReducedMotion();
  const [shown, setShown] = useState(false);
  const play = useCallback(async () => {
    if (reduceMotion) return;
    setShown(true);
    await new Promise((resolve) => window.setTimeout(resolve, COACH_SUCCESS_MS));
    setShown(false);
  }, [reduceMotion]);
  return { shown, play };
}

/**
 * The coach's ✓. `draw` plays the stroke once (about 350 ms, `.coach-check` in coach-theme.css) for
 * a check the coach just earned; a check that was already true when the screen loaded stays still.
 */
export function CoachCheck({
  draw,
  className = "size-5",
  strokeWidth = 3,
}: {
  draw: boolean;
  className?: string;
  strokeWidth?: number;
}) {
  const svg = (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d={CHECK_PATH}
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
  return draw ? (
    <SuccessCheck state="in" className="coach-check">
      {svg}
    </SuccessCheck>
  ) : (
    svg
  );
}
