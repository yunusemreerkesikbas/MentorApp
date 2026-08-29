"use client";

import type { MotionValue } from "framer-motion";
import type { JourneyLevelKey } from "@mentor/types";

import { CssBadgeRenderer } from "./css-badge-renderer";

export interface JourneyBadgeStageProps {
  levelKey: JourneyLevelKey;
  /** 0..1 across the stage. The renderer derives lighting, tilt and shadow from this alone. */
  lightX: MotionValue<number>;
  className?: string;
}

/**
 * The seam between the scene and however a badge happens to be drawn.
 *
 * Today that is `CssBadgeRenderer` — flat artwork with fake-3D lighting. When the meshy.ai GLB
 * family lands, a `GlbBadgeRenderer` (three.js behind `next/dynamic`) is selected here instead and
 * nothing above this file changes: the scene keeps handing down one level key and one light value.
 */
export function JourneyBadgeStage({ levelKey, lightX, className }: JourneyBadgeStageProps) {
  return <CssBadgeRenderer levelKey={levelKey} lightX={lightX} className={className} />;
}
