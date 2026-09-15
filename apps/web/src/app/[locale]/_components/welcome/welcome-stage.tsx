"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { Ref } from "react";
import { WELCOME_SCENES } from "@/lib/onboarding-assets";
import { WelcomeScene } from "./welcome-scene";

/**
 * The artwork half of the welcome: a native scroll-snap track, so the scene follows the finger (or
 * trackpad) and settles one slide at a time. Phone: full-bleed top band sized to leave the sheet its
 * room. Desktop: a 520×680 card beside the copy.
 */
export function WelcomeStage({
  step,
  still,
  trackRef,
  onScroll,
  skipLabel,
  onSkip,
}: {
  step: number;
  still: boolean;
  trackRef: Ref<HTMLDivElement>;
  onScroll: () => void;
  skipLabel: string;
  /** Absent on the last slide. */
  onSkip?: () => void;
}) {
  return (
    <div className="relative h-[clamp(15rem,calc(100dvh-23rem),32rem)] w-full shrink-0 overflow-hidden lg:h-[42.5rem] lg:w-[32.5rem] lg:rounded-[var(--play-sheet-radius)] lg:shadow-[var(--shadow-card-hover)]">
      <div
        ref={trackRef}
        onScroll={onScroll}
        className="flex size-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {WELCOME_SCENES.map((scene, index) => (
          <div
            key={scene.video}
            className="relative size-full shrink-0 snap-start snap-always"
            style={{ backgroundColor: scene.ground }}
          >
            <WelcomeScene
              scene={scene}
              active={index === step}
              near={Math.abs(index - step) <= 1}
              still={still}
              priority={index === 0}
            />
          </div>
        ))}
      </div>
      <AnimatePresence initial={false}>
        {onSkip ? (
          <motion.button
            key="skip"
            type="button"
            onClick={onSkip}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] h-11 rounded-full bg-[var(--play-frost)] px-4 text-sm font-bold text-[var(--play-frost-ink)] backdrop-blur-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
          >
            {skipLabel}
          </motion.button>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
