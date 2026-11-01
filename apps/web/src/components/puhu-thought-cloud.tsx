"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import "./puhu-thought-cloud.css";

/*
 * One timeline for Puhu's thought (DESIGN.md §9): ease-out, no overshoot, the entrance inside the
 * 600 ms Moment, every exit 150 ms. Puhu appears, the thought rises from it (small dot, big dot)
 * and the cloud opens from the trail. A parent drives it with the labels hidden → shown → gone.
 * Reduced motion swaps every part to PUHU_FADE (MotionConfig's "user" mode would still snap the
 * exit scale on before the fade).
 */
const EASE_OUT = [0.22, 1, 0.36, 1] as const;
const EXIT = { duration: 0.15, ease: "easeOut" } as const;

export const PUHU_FADE: Variants = {
  hidden: { opacity: 0 },
  shown: { opacity: 1, transition: { duration: 0.2, ease: "easeOut" } },
  gone: { opacity: 0, transition: EXIT },
};

export const PUHU_MASCOT: Variants = {
  hidden: { opacity: 0, scale: 0.8, y: 12 },
  shown: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.28, ease: EASE_OUT } },
  gone: { opacity: 0, scale: 0.9, y: 8, transition: EXIT },
};

function dot(delay: number): Variants {
  return {
    hidden: { opacity: 0, scale: 0 },
    shown: { opacity: 1, scale: 1, transition: { duration: 0.2, ease: EASE_OUT, delay } },
    gone: { opacity: 0, scale: 0.4, transition: EXIT },
  };
}

const SMALL_DOT = dot(0.12);
const BIG_DOT = dot(0.18);

const CLOUD: Variants = {
  hidden: { opacity: 0, scale: 0.55 },
  shown: { opacity: 1, scale: 1, transition: { duration: 0.32, ease: EASE_OUT, delay: 0.24 } },
  gone: { opacity: 0, scale: 0.7, transition: EXIT },
};

export function PuhuSpeechBubble({
  children,
  onShown,
}: {
  children: ReactNode;
  /** Fires once the cloud has fully opened. */
  onShown?: () => void;
}) {
  const reduce = useReducedMotion();
  return (
    <div className="puhu-speech-bubble">
      <motion.div
        className="puhu-speech-bubble__body"
        variants={reduce ? PUHU_FADE : CLOUD}
        onAnimationComplete={(label) => {
          if (label === "shown") onShown?.();
        }}
      >
        <svg
          className="puhu-speech-bubble__cloud"
          viewBox="0 0 400 280"
          preserveAspectRatio="none"
          aria-hidden="true"
          focusable="false"
        >
          <path
            vectorEffect="non-scaling-stroke"
            d="M 48 76 C 24 36 76 8 120 26 C 151 -4 202 -2 228 24 C 276 0 330 18 338 56 C 384 54 408 98 384 132 C 410 166 390 210 352 216 C 350 258 294 278 252 258 C 218 282 158 282 130 258 C 84 276 36 252 40 216 C 0 208 -8 162 18 140 C -4 108 10 80 48 76 Z"
          />
        </svg>
        <div className="puhu-speech-bubble__panel">{children}</div>
      </motion.div>
      <motion.span
        className="puhu-speech-bubble__dot puhu-speech-bubble__dot--big"
        variants={reduce ? PUHU_FADE : BIG_DOT}
        aria-hidden="true"
      />
      <motion.span
        className="puhu-speech-bubble__dot puhu-speech-bubble__dot--small"
        variants={reduce ? PUHU_FADE : SMALL_DOT}
        aria-hidden="true"
      />
    </div>
  );
}
