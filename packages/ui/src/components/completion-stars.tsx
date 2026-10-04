"use client";

import { Star } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

const STAR_EASE = [0.22, 1, 0.36, 1] as const;
const FILL_MS = 0.2;
const STAGGER_S = 0.08;
const SIDE_SIZE = 40;
const CENTER_SIZE = 56;

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

/**
 * Celebratory star row. Presentational: the caller decides `filled`.
 * Half stars clip a Lucide `Star`; empty uses the progress-track stroke.
 */
export function CompletionStars({
  filled,
  total = 3,
  label,
  className,
}: CompletionStarsProps) {
  const reduceMotion = useReducedMotion();
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
          fill={fillAt(safeFilled, index)}
          size={starSize(index, safeTotal)}
          delay={index * STAGGER_S}
          reduceMotion={Boolean(reduceMotion)}
        />
      ))}
    </div>
  );
}

function CompletionStar({
  fill,
  size,
  delay,
  reduceMotion,
}: {
  fill: 0 | 0.5 | 1;
  size: number;
  delay: number;
  reduceMotion: boolean;
}) {
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
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
          duration: reduceMotion ? 0 : FILL_MS,
          delay: reduceMotion ? 0 : delay,
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
    </span>
  );
}
