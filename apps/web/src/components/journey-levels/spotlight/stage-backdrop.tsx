"use client";

import { AnimatePresence, motion, type MotionValue, useTransform } from "framer-motion";
import type { JourneyLevelKey } from "@mentor/types";

import { JOURNEY_LEVEL_CATALOG, type JourneyLevelCatalogItem } from "../journey-level-catalog";
import { JourneyLevelMedallion } from "../journey-level-medallion";
import { neighbourLightIntensity } from "./spotlight-choreography";

const WORD_CLASS =
  "pointer-events-none block select-none whitespace-nowrap text-center text-[16vw] font-extrabold uppercase leading-none tracking-tight";

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
  /** Tier currently on stage; the neighbours either side are read from the catalog. */
  tier: number;
  /** The student's real tier — decides which badge wears the accent ring and which stay locked. */
  ownTier: number;
  /**
   * The level's own name, written across the back wall. It carries the name so the copy below can
   * stay to "Seviye 3" — the alternative was the same word twice on one screen. Decorative here:
   * the accessible name still comes from the heading.
   */
  backdropWord: string;
  lightX: MotionValue<number>;
  /** Nothing is on stage until the lamp is on. */
  lit: boolean;
  /** Travel to a neighbour. Omitted during a celebration, which stays a single moment. */
  onTravel?: (item: JourneyLevelCatalogItem, slot: -1 | 1) => void;
  travelLabel: (levelKey: JourneyLevelKey) => string;
}

/**
 * What the sweep is *for*. Swinging the beam grazes the level just earned and the one still locked,
 * and lights up the chapter name written across the back wall — so one gesture teaches the ladder
 * instead of just showing off. Clicking a neighbour travels to it.
 *
 * The chapter word is decorative; the neighbours are not, so they are real buttons and reachable
 * by keyboard even though the beam that reveals them is mouse-driven.
 */
export function StageBackdrop({
  tier,
  ownTier,
  backdropWord,
  lightX,
  lit,
  onTravel,
  travelLabel,
}: StageBackdropProps) {
  const previous = JOURNEY_LEVEL_CATALOG.find((item) => item.tier === tier - 1);
  const next = JOURNEY_LEVEL_CATALOG.find((item) => item.tier === tier + 1);

  /* Trade-off, not a fade: beam on the badge hides the wall, beam aside reveals it. */
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
      <AnimatePresence initial={false}>
        <motion.div
          key={backdropWord}
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-[40%] -translate-y-1/2"
          initial={{ opacity: 0, scale: 1.08 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.94 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        >
          <span
            className={`${WORD_CLASS} text-[color-mix(in_srgb,var(--color-main)_7%,transparent)]`}
          >
            {backdropWord}
          </span>
          <span
            className={`${WORD_CLASS} absolute inset-x-0 top-0 text-[color-mix(in_srgb,var(--spotlight-beam)_60%,transparent)]`}
            style={{ maskImage: WORD_LIGHT_MASK, WebkitMaskImage: WORD_LIGHT_MASK }}
          >
            {backdropWord}
          </span>
        </motion.div>
      </AnimatePresence>

      <NeighbourSlot
        item={previous}
        slot={-1}
        ownTier={ownTier}
        opacity={previousOpacity}
        onTravel={onTravel}
        travelLabel={travelLabel}
      />
      <NeighbourSlot
        item={next}
        slot={1}
        ownTier={ownTier}
        opacity={nextOpacity}
        onTravel={onTravel}
        travelLabel={travelLabel}
      />
    </motion.div>
  );
}

function NeighbourSlot({
  item,
  slot,
  ownTier,
  opacity,
  onTravel,
  travelLabel,
}: {
  item: JourneyLevelCatalogItem | undefined;
  slot: -1 | 1;
  ownTier: number;
  opacity: MotionValue<number>;
  onTravel?: (item: JourneyLevelCatalogItem, slot: -1 | 1) => void;
  travelLabel: (levelKey: JourneyLevelKey) => string;
}) {
  /* The ends of the ladder simply have empty stage on that side. */
  if (!item) return null;

  const badge = (
    <JourneyLevelMedallion
      levelKey={item.key}
      current={item.tier === ownTier}
      future={item.tier > ownTier}
      className="size-14 sm:size-20"
    />
  );

  return (
    <motion.div
      className={`absolute top-1/2 -translate-y-1/2 ${slot === -1 ? "left-[6%]" : "right-[6%]"}`}
      style={{ opacity }}
    >
      {onTravel ? (
        <button
          type="button"
          onClick={() => onTravel(item, slot)}
          aria-label={travelLabel(item.key)}
          className="pointer-events-auto rounded-full transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg)] motion-reduce:transition-none motion-reduce:hover:scale-100"
        >
          {badge}
        </button>
      ) : (
        badge
      )}
    </motion.div>
  );
}
