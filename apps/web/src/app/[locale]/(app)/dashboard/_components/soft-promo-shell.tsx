"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { motion, useReducedMotion, type Variants } from "framer-motion";

/** White border draw + bg glow on hover — DESIGN.md §9 micro. No scale. */
const DRAW_EASE = [0.22, 1, 0.36, 1] as const;
/** Matches --radius-card (DESIGN.md §5). */
const CARD_RADIUS = 10;
const STROKE = 2;

const shellVariants: Variants = {
  rest: {
    boxShadow: "var(--shadow-card)",
  },
  hover: {
    boxShadow:
      "0 0 0 1px rgba(255,255,255,0.55), 0 0 28px rgba(255,255,255,0.4), 0 4px 14px rgba(37, 73, 150, 0.10)",
    transition: { duration: 0.45, ease: DRAW_EASE },
  },
};

const bgGlowVariants: Variants = {
  rest: { opacity: 0 },
  hover: {
    opacity: 1,
    transition: { duration: 0.45, ease: DRAW_EASE },
  },
};

const borderVariants: Variants = {
  rest: {
    pathLength: 0,
    opacity: 0,
  },
  hover: {
    pathLength: 1,
    opacity: 1,
    transition: {
      pathLength: { duration: 0.85, ease: DRAW_EASE },
      opacity: { duration: 0.12 },
    },
  },
};

type SoftPromoShellProps = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
};

/**
 * PromoSoft card shell: on hover, white border stroke draws along the edge and
 * a soft white background glow fades in. No scale.
 */
export function SoftPromoShell({ children, className, style }: SoftPromoShellProps) {
  const reduceMotion = useReducedMotion();
  const rootRef = useRef<HTMLElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    const update = () => {
      setSize({ w: el.offsetWidth, h: el.offsetHeight });
    };
    update();

    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Center stroke on the outer edge: path inset by half stroke so the line sits on the border.
  const inset = STROKE / 2;
  const rectW = Math.max(0, size.w - STROKE);
  const rectH = Math.max(0, size.h - STROKE);
  const rectRx = Math.max(0, CARD_RADIUS - inset);

  return (
    <motion.article
      ref={rootRef}
      className={[
        "relative min-w-0 overflow-hidden rounded-[var(--radius-card)]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={style}
      initial="rest"
      animate="rest"
      whileHover={reduceMotion ? undefined : "hover"}
      variants={shellVariants}
    >
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 rounded-[var(--radius-card)]"
        style={{
          background:
            "radial-gradient(ellipse 85% 75% at 50% 40%, rgba(255,255,255,0.72) 0%, rgba(255,255,255,0.2) 45%, transparent 75%)",
        }}
        variants={bgGlowVariants}
      />
      {size.w > 0 && size.h > 0 ? (
        <svg
          aria-hidden
          className="pointer-events-none absolute inset-0 z-[2] overflow-visible"
          width={size.w}
          height={size.h}
          viewBox={`0 0 ${size.w} ${size.h}`}
          fill="none"
        >
          <motion.rect
            x={inset}
            y={inset}
            width={rectW}
            height={rectH}
            rx={rectRx}
            ry={rectRx}
            stroke="white"
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeLinejoin="round"
            variants={borderVariants}
            style={{
              filter: "drop-shadow(0 0 5px rgba(255,255,255,0.95))",
            }}
          />
        </svg>
      ) : null}
      <div className="relative z-[1]">{children}</div>
    </motion.article>
  );
}
