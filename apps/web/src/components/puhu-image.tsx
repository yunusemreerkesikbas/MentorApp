"use client";

import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { CareerGroup } from "@mentor/types";

export type PuhuVariant =
  | "default"
  | "encouraging"
  | "happy"
  | "host"
  | "premium"
  | "proud"
  | "surprised"
  | "winking";

/** DESIGN.md §8.2 — companion size scale. */
export const PUHU_SIZES = {
  sm: 40,
  md: 72,
  lg: 120,
} as const;

export type PuhuSizeToken = keyof typeof PUHU_SIZES;

const FILE_BY_VARIANT: Record<PuhuVariant, string> = {
  default: "puhu-default.png",
  encouraging: "puhu-encouraging.png",
  happy: "puhu-happy.png",
  host: "puhu-host.png",
  premium: "puhu-premium.png",
  proud: "puhu-proud.png",
  surprised: "puhu-surprised.png",
  winking: "puhu-happy.png",
};

const SWAP_EASE = "easeOut" as const;

function resolvePuhuSize(size: PuhuSizeToken | number): number {
  return typeof size === "number" ? size : PUHU_SIZES[size];
}

export function PuhuImage({
  variant,
  career = null,
  size = "lg",
  className,
  priority = false,
}: {
  variant: PuhuVariant;
  /**
   * Career field the user is aiming for. When set, it REPLACES the variant artwork with a
   * dedicated illustration under `/mascot/career/{enum}.png`. Ten finished files rather than
   * an accessory overlay: an overlay anchored for one pose drifts on the other seven.
   */
  career?: CareerGroup | null;
  /** Token (`sm`/`md`/`lg`) or raw px for special layouts (mood wheel, onboarding). */
  size?: PuhuSizeToken | number;
  className?: string;
  priority?: boolean;
}) {
  const px = resolvePuhuSize(size);
  const reduceMotion = useReducedMotion();
  const src = career
    ? `/mascot/career/${career.toLowerCase()}.png`
    : `/mascot/puhu/${FILE_BY_VARIANT[variant]}`;
  const swapKey = career ?? variant;
  const transition = {
    duration: reduceMotion ? 0.15 : 0.28,
    ease: SWAP_EASE,
  };

  return (
    <span
      className={className}
      style={{
        display: "inline-block",
        position: "relative",
        width: px,
        height: px,
        maxWidth: "100%",
      }}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={swapKey}
          className="absolute inset-0 flex items-center justify-center"
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.92 }}
          animate={reduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
          transition={transition}
        >
          <Image
            src={src}
            alt=""
            width={px}
            height={px}
            aria-hidden
            priority={priority}
            style={{ width: px, height: "auto", maxWidth: "100%" }}
          />
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
