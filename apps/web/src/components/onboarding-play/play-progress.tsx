"use client";

import { motion, useReducedMotion } from "framer-motion";

/**
 * 12px progress pill. `done` already counts the question on screen, and each step mounts its own
 * bar, so the fill grows from the previous position instead of popping in.
 */
export function PlayProgress({ done, total, label }: { done: number; total: number; label: string }) {
  const reduceMotion = useReducedMotion();
  const width = `${(done / total) * 100}%`;

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={done}
      className="h-3 w-full overflow-hidden rounded-full bg-[var(--play-track)]"
    >
      <motion.div
        className="relative h-full rounded-full bg-[var(--play-cta)]"
        initial={reduceMotion ? false : { width: `${(Math.max(done - 1, 0) / total) * 100}%` }}
        animate={{ width }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
        <span aria-hidden className="absolute inset-x-2 top-[3px] h-[3px] rounded-full bg-[var(--play-cta-shine)]" />
      </motion.div>
    </div>
  );
}
