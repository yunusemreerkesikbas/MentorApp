import type { Variants, Transition } from "framer-motion";

/**
 * Content-layer stagger (DESIGN.md §9).
 * Pair with `useReducedMotion()` — skip variants when reduced.
 * Layers: micro / chrome / content (this) / ambient (blobs) / moment (≤600ms).
 */
export const staggerListVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.15 },
  },
};

export const staggerItemVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.25, ease: "easeOut" },
  },
};

/** Coach chat bubble enter — transform/opacity only (DESIGN.md §9). */
export const chatBubbleTransition: Transition = {
  duration: 0.38,
  ease: [0.22, 1, 0.36, 1],
};

export const chatBubbleInitial = { opacity: 0, y: 14 } as const;
export const chatBubbleAnimate = { opacity: 1, y: 0 } as const;
