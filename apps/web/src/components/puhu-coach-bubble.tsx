"use client";

import { useState } from "react";
import X from "lucide-react/dist/esm/icons/x.mjs";
import { motion, useReducedMotion } from "framer-motion";
import { PuhuImage, type PuhuSizeToken, type PuhuVariant } from "@/components/puhu-image";

export interface PuhuCoachBubbleProps {
  message: string;
  variant?: PuhuVariant;
  /** DESIGN.md §8.2 — token or raw px. Default `md` (72). */
  puhuSize?: PuhuSizeToken | number;
  dismissible?: boolean;
  /** Subtle vertical bounce on mascot (celebration / nudge). */
  bounce?: boolean;
  className?: string;
  dismissLabel?: string;
}

/**
 * Mascot-attached coach speech bubble (Stitch Prompt 6 / DESIGN.md coach bubble).
 * Bubble tail points toward Puhu below-left.
 */
export function PuhuCoachBubble({
  message,
  variant = "encouraging",
  puhuSize = "md",
  dismissible = true,
  bounce = false,
  className,
  dismissLabel = "Kapat",
}: PuhuCoachBubbleProps) {
  const reduceMotion = useReducedMotion();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const bubbleMotion = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 12 },
        animate: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.28, ease: "easeOut" as const },
        },
      };

  return (
    <div className={className}>
      <motion.div
        className="mentor-coach-bubble relative max-w-[280px] rounded-[var(--radius-card)] border border-white bg-white p-4 shadow-[var(--shadow-card)]"
        {...bubbleMotion}
      >
        {dismissible ? (
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="absolute right-2 top-2 inline-flex min-h-8 min-w-8 cursor-pointer items-center justify-center rounded-[var(--radius-card)] transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none"
            style={{ color: "var(--color-secondary)" }}
            aria-label={dismissLabel}
          >
            <X className="size-4" aria-hidden />
          </button>
        ) : null}
        <p
          className="pr-6 text-sm leading-relaxed"
          style={{ color: "var(--color-body)", fontFamily: "var(--font-body)" }}
        >
          {message}
        </p>
      </motion.div>
      <div
        className={
          bounce && !reduceMotion ? "mentor-puhu-bounce mt-2 w-fit" : "mt-2 w-fit"
        }
      >
        <PuhuImage variant={variant} size={puhuSize} />
      </div>
    </div>
  );
}
