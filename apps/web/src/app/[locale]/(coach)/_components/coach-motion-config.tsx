"use client";

import type { ReactNode } from "react";
import { MotionConfig } from "framer-motion";

/**
 * framer's reduced-motion rule for the whole coach surface, set once: with the OS setting on,
 * transforms and layout animations stop and only opacity and color change.
 */
export function CoachMotionConfig({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
