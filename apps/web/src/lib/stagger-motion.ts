import type { Variants } from "framer-motion";

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
