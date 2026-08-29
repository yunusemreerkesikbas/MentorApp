"use client";

import { motion, type MotionValue, useTransform } from "framer-motion";

import { JOURNEY_LEVEL_CATALOG } from "../journey-level-catalog";
import { JourneyLevelMedallion } from "../journey-level-medallion";
import { neighbourLightIntensity } from "./spotlight-choreography";

const WORD_CLASS =
  "pointer-events-none absolute inset-x-0 top-[40%] -translate-y-1/2 select-none whitespace-nowrap text-center text-[16vw] font-extrabold uppercase leading-none tracking-tight";

/**
 * Where the beam meets the back wall, not where the lamp hangs. The rig pivots at the ceiling, so
 * at depth `d` the patch shifts by `d · tan(angle)`. At this word's depth (40% of the viewport)
 * and the rig's 38° limit that is roughly 17% of the width each way, hence the 40% span across
 * `--spotlight-x`'s full 0..1 range.
 *
 * Guessing this number is how the effect dies: an over-large span throws the lit patch off-screen
 * at exactly the sweep extremes, so the word stays dark when the beam is most dramatic.
 */
const WORD_LIGHT_MASK =
  "radial-gradient(ellipse 24% 130% at calc(50% + (var(--spotlight-x) - 0.5) * 40%) 50%, #000 5%, rgba(0,0,0,0.35) 45%, transparent 78%)";

interface StageBackdropProps {
  /** Current level's tier; the neighbours either side are read from the catalog. */
  tier: number;
  /** Short chapter name ("Uyanış"), not the numbered label — that already sits under the badge. */
  chapterName: string;
  lightX: MotionValue<number>;
  /** Nothing is on stage until the lamp is on. */
  lit: boolean;
}

/**
 * What the sweep is *for*. Swinging the beam grazes the level just earned and the one still locked,
 * and lights up the chapter name written across the back wall — so one gesture teaches the ladder
 * instead of just showing off.
 *
 * Decorative only: the guide dialog already lists all twelve levels, so nothing here is the sole
 * source of any information and a keyboard user misses nothing by not being able to swing the lamp.
 */
export function StageBackdrop({ tier, chapterName, lightX, lit }: StageBackdropProps) {
  const previous = JOURNEY_LEVEL_CATALOG.find((item) => item.tier === tier - 1);
  const next = JOURNEY_LEVEL_CATALOG.find((item) => item.tier === tier + 1);

  const previousOpacity = useTransform(
    lightX,
    (x) => 0.08 + neighbourLightIntensity(x, -1) * 0.72,
  );
  const nextOpacity = useTransform(
    lightX,
    (x) => 0.08 + neighbourLightIntensity(x, 1) * 0.62,
  );

  return (
    <motion.div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-0"
      initial={{ opacity: 0 }}
      animate={{ opacity: lit ? 1 : 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      {/* Two copies of the same word. The dim one is the wall in the dark; the bright one is
          masked to the beam, so letters light up as the light crosses them instead of the whole
          word brightening at once.

          Sits behind the badge, not the viewport centre: the badge and its copy are centred as one
          group, so the badge lands above the midline and a word at 50% would cut into the story
          text. Long names ("Birlikte Işık") bleed off both edges on purpose — the parent clips. */}
      <span className={`${WORD_CLASS} text-[color-mix(in_srgb,var(--color-main)_7%,transparent)]`}>
        {chapterName}
      </span>
      <span
        className={`${WORD_CLASS} text-[color-mix(in_srgb,var(--spotlight-beam)_60%,transparent)]`}
        style={{ maskImage: WORD_LIGHT_MASK, WebkitMaskImage: WORD_LIGHT_MASK }}
      >
        {chapterName}
      </span>

      {previous ? (
        <motion.span
          className="absolute left-[6%] top-1/2 -translate-y-1/2"
          style={{ opacity: previousOpacity }}
        >
          <JourneyLevelMedallion levelKey={previous.key} className="size-14 sm:size-20" />
        </motion.span>
      ) : null}

      {next ? (
        <motion.span
          className="absolute right-[6%] top-1/2 -translate-y-1/2"
          style={{ opacity: nextOpacity }}
        >
          <JourneyLevelMedallion levelKey={next.key} future className="size-14 sm:size-20" />
        </motion.span>
      ) : null}
    </motion.div>
  );
}
