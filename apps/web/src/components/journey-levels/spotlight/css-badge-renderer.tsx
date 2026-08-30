"use client";

import { motion, type MotionValue, useTransform } from "framer-motion";
import type { JourneyLevelKey } from "@mentor/types";

import { JourneyLevelMedallion } from "../journey-level-medallion";
import { badgeLightIntensity } from "./spotlight-choreography";

interface CssBadgeRendererProps {
  levelKey: JourneyLevelKey;
  lightX: MotionValue<number>;
  current?: boolean;
  future?: boolean;
  className?: string;
}

/**
 * Fake-3D badge: the flat artwork tilts away from the lamp, a specular band tracks the beam and a
 * shade layer swallows it when the beam swings off. No new asset, no 3D runtime — and every layer
 * animates on `opacity` or `transform`, so the whole rig stays on the compositor.
 *
 * ponytail: this is the v1 behind `JourneyBadgeStage`. A GLB renderer slots in beside it later
 * with the same two props; nothing above this file changes.
 */
export function CssBadgeRenderer({
  levelKey,
  lightX,
  current = false,
  future = false,
  className,
}: CssBadgeRendererProps) {
  const intensity = useTransform(lightX, (x) => badgeLightIntensity(x));
  /* Tilt away from the lamp — the far edge of a medal turns out of the light. */
  const rotateY = useTransform(lightX, [0, 1], [16, -16]);
  const rotateX = useTransform(intensity, [0, 1], [7, 0]);
  /* Shade covers the badge as the beam leaves. */
  const shade = useTransform(intensity, (value) => 0.86 * (1 - value));
  /* Specular band sweeps across the face, leading the light slightly. */
  const specularX = useTransform(lightX, [0, 1], ["-62%", "62%"]);
  const specularOpacity = useTransform(intensity, [0.25, 1], [0, 0.55]);

  /* No cast shadow here on purpose. The badge floats in the beam with unlit air behind it, so a
     dark blob under it is black on black — it was invisible for as long as it existed. The real
     shadow is light *missing* from the floor pool, and it lives in the scene next to that pool. */

  return (
    <div className={`relative [perspective:900px] ${className ?? ""}`}>
      <motion.div
        className="relative size-full will-change-transform [transform-style:preserve-3d]"
        style={{ rotateY, rotateX }}
      >
        <JourneyLevelMedallion
          levelKey={levelKey}
          current={current}
          future={future}
          className="size-full"
        />

        <motion.span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-full"
          style={{ opacity: specularOpacity }}
        >
          <motion.span
            className="absolute -inset-y-8 left-1/2 w-1/3 -translate-x-1/2 rotate-[18deg] bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.85),transparent)] blur-[6px] will-change-transform"
            style={{ x: specularX }}
          />
        </motion.span>

        <motion.span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-full bg-black"
          style={{ opacity: shade }}
        />
      </motion.div>
    </div>
  );
}
