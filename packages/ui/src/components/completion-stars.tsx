"use client";

import { Star } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

const STAR_EASE = [0.22, 1, 0.36, 1] as const;
const SIDE_SIZE = 40;
const CENTER_SIZE = 56;

/** First star lands while the card settles; each next one a beat later. */
const FIRST_DELAY_S = 0.12;
const STEP_S = 0.14;
/**
 * Pop with a ~18 % overshoot. Session done is a celebration moment the product owner widened
 * like the achievement scene (DESIGN.md §9.1): the overshoot lives here and nowhere else.
 */
const POP_S = 0.42;
const FILL_S = 0.26;
const BURST_S = 0.55;
const SPARKS = 6;

export interface CompletionStarsProps {
  /** Fill amount in 0.5 steps. Clamped to `[0, total]`. */
  filled: number;
  total?: number;
  /** Localized accessible name, e.g. "2.5 / 3 stars". */
  label: string;
  className?: string;
}

function snapFill(filled: number, total: number): number {
  const snapped = Math.round(filled * 2) / 2;
  return Math.min(total, Math.max(0, snapped));
}

function fillAt(filled: number, index: number): 0 | 0.5 | 1 {
  const rem = filled - index;
  if (rem >= 1) return 1;
  if (rem <= 0) return 0;
  return 0.5;
}

function starSize(index: number, total: number): number {
  if (total === 3 && index === 1) return CENTER_SIZE;
  return SIDE_SIZE;
}

/** Reveal order: the big centre star of three lands last; any other row goes left to right. */
function revealStep(index: number, total: number): number {
  if (total !== 3) return index;
  return [0, 2, 1][index] ?? index;
}

/**
 * Total length of the star reveal, so the summary can bring its copy in right behind it.
 * Matches the last star's pop, not its sparks (those may still be fading).
 */
export function completionStarsRevealSeconds(total = 3): number {
  return FIRST_DELAY_S + (Math.max(1, Math.round(total)) - 1) * STEP_S + POP_S;
}

/**
 * Celebratory star row. Presentational: the caller decides `filled`.
 * Each star pops in, a filled one sweeps its fill, rings once and throws a few sparks.
 * Half stars clip a Lucide `Star`; empty uses the progress-track stroke.
 * Reduced motion: the final row, no movement (DESIGN.md §9.1).
 */
export function CompletionStars({
  filled,
  total = 3,
  label,
  className,
}: CompletionStarsProps) {
  const reduceMotion = Boolean(useReducedMotion());
  const safeTotal = Math.max(1, Math.round(total));
  const safeFilled = snapFill(filled, safeTotal);

  return (
    <div
      role="img"
      aria-label={label}
      className={`flex items-end justify-center gap-2 ${className ?? ""}`}
    >
      {Array.from({ length: safeTotal }, (_, index) => (
        <CompletionStar
          key={index}
          index={index}
          fill={fillAt(safeFilled, index)}
          size={starSize(index, safeTotal)}
          delay={FIRST_DELAY_S + revealStep(index, safeTotal) * STEP_S}
          reduceMotion={reduceMotion}
        />
      ))}
    </div>
  );
}

function CompletionStar({
  index,
  fill,
  size,
  delay,
  reduceMotion,
}: {
  index: number;
  fill: 0 | 0.5 | 1;
  size: number;
  delay: number;
  reduceMotion: boolean;
}) {
  const lit = fill > 0 && !reduceMotion;
  const burstAt = delay + POP_S * 0.55;

  return (
    <motion.span
      className="relative inline-flex shrink-0"
      style={{ width: size, height: size }}
      initial={reduceMotion ? false : { scale: 0, rotate: -30, opacity: 0 }}
      // `initial={false}` alone still plays a keyframe array; reduced motion gets plain targets.
      animate={
        reduceMotion
          ? { scale: 1, rotate: 0, opacity: 1 }
          : { scale: [0, 1.18, 1], rotate: [-30, 6, 0], opacity: 1 }
      }
      transition={{
        duration: POP_S,
        delay,
        ease: "easeOut",
        times: [0, 0.6, 1],
        opacity: { duration: POP_S * 0.4, delay },
      }}
    >
      {lit ? (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-full"
          style={{
            background:
              "radial-gradient(circle, color-mix(in srgb, var(--color-star) 55%, transparent) 0%, transparent 70%)",
          }}
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1.9, opacity: [0, 0.9, 0] }}
          transition={{ duration: BURST_S, delay: burstAt, ease: STAR_EASE }}
        />
      ) : null}
      {lit
        ? Array.from({ length: SPARKS }, (_, spark) => {
            // Offset each star's fan so neighbouring sparks do not line up.
            const angle = ((spark + index * 0.5) / SPARKS) * Math.PI * 2;
            const reach = size * (spark % 2 === 0 ? 0.95 : 0.75);
            const dot = spark % 2 === 0 ? 6 : 4;
            return (
              <motion.span
                key={spark}
                aria-hidden
                className="pointer-events-none absolute rounded-full"
                style={{
                  width: dot,
                  height: dot,
                  left: size / 2 - dot / 2,
                  top: size / 2 - dot / 2,
                  backgroundColor: "var(--color-star)",
                }}
                initial={{ x: 0, y: 0, scale: 0, opacity: 0 }}
                animate={{
                  x: Math.cos(angle) * reach,
                  y: Math.sin(angle) * reach,
                  scale: [0, 1, 0],
                  opacity: [0, 1, 0],
                }}
                transition={{ duration: BURST_S, delay: burstAt, ease: STAR_EASE }}
              />
            );
          })
        : null}
      <Star
        aria-hidden
        size={size}
        strokeWidth={1.6}
        className="absolute inset-0"
        color="var(--color-progress-track)"
        fill="none"
      />
      <motion.span
        aria-hidden
        className="absolute inset-y-0 left-0 overflow-hidden"
        initial={reduceMotion ? false : { width: 0 }}
        animate={{ width: `${fill * 100}%` }}
        transition={{
          duration: reduceMotion ? 0 : FILL_S,
          delay: reduceMotion ? 0 : delay + POP_S * 0.35,
          ease: STAR_EASE,
        }}
      >
        <Star
          size={size}
          strokeWidth={1.6}
          color="var(--color-star)"
          fill="var(--color-star)"
        />
      </motion.span>
    </motion.span>
  );
}
