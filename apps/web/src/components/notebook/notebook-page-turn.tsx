"use client";

import { motion } from "framer-motion";
import type { NotebookPaper } from "@mentor/types";
import { PAGE_PERCENT, PAPERS } from "./notebook-surface";

/**
 * The leaf that turns.
 *
 * A real book turns ONE leaf, hinged at the spine, and that leaf lands face-down on the facing page
 * — it does not slide both pages sideways. This draws exactly that: a single page-sized sheet that
 * lifts off its slot, swings 180° through the spine, and settles over the other side, shading itself
 * and casting a moving shadow on the page it falls onto.
 *
 * Purely decorative (`aria-hidden`, `pointer-events: none`): it flies over the two live stages
 * rather than being one of them, so the drag/select layer underneath never has to be torn down and
 * rebuilt mid-turn. The content swap happens underneath, timed to land while the leaf covers it.
 *
 * ponytail: the sheet is blank ruled paper, not a render of the outgoing page's items — carrying the
 * real content would mean holding a third and fourth page document in flight just for ~600ms nobody
 * can read. If a flying page ever needs its own items, that is the change: fetch `left±2` eagerly and
 * render a non-interactive `NotebookPageStage` into the two faces below.
 *
 * ponytail: the curl is shading, not geometry — a rigid sheet plus a sheen/crease gradient and a
 * softened leading edge. True per-column deformation (the paper visibly bowing) needs WebGL or a
 * canvas page-flip library, and both want to own the DOM our interactive stages already live in.
 *
 * `single` (mobile): only one leaf of the spread is ever visible at a time there, so the flying
 * sheet is the full width of its slot rather than one of two page-percent columns, and it always
 * hinges on the left — a phone shows one page bound at its own spiral, not a spread whose spine
 * could be on either side. `dir` still says which way it turns; only the geometry stops depending
 * on it.
 */

/**
 * Derived from the same spread geometry the shell lays out with, so the leaf is exactly one page
 * wide and lands aligned with the slot it falls into rather than a few px off it.
 */
const PAGE_WIDTH = `${PAGE_PERCENT}%`;
const RIGHT_PAGE_LEFT = `${100 - PAGE_PERCENT}%`;

/** Long enough to read as paper with weight, short enough that it never feels like waiting. */
export const PAGE_TURN_SECONDS = 0.78;

/**
 * Tight enough that the sheet visibly foreshortens as it swings — a far perspective flattens the
 * arc into something that reads as a wipe rather than as a page standing up off the book.
 */
const TURN_PERSPECTIVE = 1400;

/**
 * Front face: a dark crease where the sheet bends into the spine, and a bright sheen along the free
 * edge that lifts — the two cues that make a flat rectangle read as a curled page.
 */
const FRONT_SHEEN = {
  forward:
    "linear-gradient(to right, rgba(0,0,0,0.24), rgba(0,0,0,0) 16%, rgba(0,0,0,0) 60%, rgba(255,255,255,0.55) 89%, rgba(0,0,0,0.14) 100%)",
  backward:
    "linear-gradient(to left, rgba(0,0,0,0.24), rgba(0,0,0,0) 16%, rgba(0,0,0,0) 60%, rgba(255,255,255,0.55) 89%, rgba(0,0,0,0.14) 100%)",
};

/** Back face: the underside of paper — no ruling, no binding, just the grey falloff of the curl. */
const BACK_SHADE = {
  forward:
    "linear-gradient(to right, rgba(0,0,0,0.30), rgba(0,0,0,0.14) 45%, rgba(0,0,0,0.04) 100%)",
  backward:
    "linear-gradient(to left, rgba(0,0,0,0.30), rgba(0,0,0,0.14) 45%, rgba(0,0,0,0.04) 100%)",
};

export interface NotebookPageTurnProps {
  /** +1 turns the right leaf onto the left page, -1 turns the left leaf onto the right. */
  dir: 1 | -1;
  /** Ruling of the page being turned, so the flying sheet matches the book it came out of. */
  paper: NotebookPaper;
  /** One full-width leaf hinged on the left, instead of one of two page-percent spread columns. */
  single?: boolean;
  onDone: () => void;
}

export function NotebookPageTurn({ dir, paper, single, onDone }: NotebookPageTurnProps) {
  const forward = dir > 0;
  // Single mode's leaf is always the same physical shape (left-bound, free edge on the right), so
  // it reuses exactly the "forward" geometry below regardless of which way `dir` points.
  const key = single || forward ? "forward" : "backward";
  const leafLeft = single ? "0%" : forward ? RIGHT_PAGE_LEFT : "0%";
  const leafWidth = single ? "100%" : PAGE_WIDTH;
  const origin = single || forward ? "left center" : "right center";
  const frontRadius = single || forward ? "0 12px 12px 0" : "12px 0 0 12px";
  const backRadius = single || forward ? "12px 0 0 12px" : "0 12px 12px 0";

  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        perspective: TURN_PERSPECTIVE,
        zIndex: 30,
      }}
    >
      {/* The shadow the leaf drags across the page it is falling onto — darkest at the spine, where
          the sheet is closest to the paper, and gone again once it has settled flat. */}
      <motion.div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: single ? "0%" : forward ? 0 : RIGHT_PAGE_LEFT,
          width: leafWidth,
          backgroundImage:
            single || forward
              ? "linear-gradient(to left, rgba(0,0,0,0.52), transparent 78%)"
              : "linear-gradient(to right, rgba(0,0,0,0.52), transparent 78%)",
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 0] }}
        transition={{ duration: PAGE_TURN_SECONDS, times: [0, 0.55, 1], ease: "easeInOut" }}
      />

      <motion.div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: leafLeft,
          width: leafWidth,
          transformOrigin: origin,
          transformStyle: "preserve-3d",
        }}
        initial={{ rotateY: 0, scaleY: 1 }}
        // `scaleY` is the bow: a sheet standing on its edge is momentarily shorter than one lying
        // flat, and without it the turn reads as a rigid door rather than paper.
        animate={{ rotateY: forward ? -180 : 180, scaleY: [1, 0.952, 1] }}
        transition={{
          rotateY: { duration: PAGE_TURN_SECONDS, ease: [0.45, 0.05, 0.25, 1] },
          scaleY: { duration: PAGE_TURN_SECONDS, times: [0, 0.5, 1], ease: "easeInOut" },
        }}
        onAnimationComplete={onDone}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            backfaceVisibility: "hidden",
            overflow: "hidden",
            // The ruling below is sized in `cqw`, exactly as on a real page surface.
            containerType: "inline-size",
            backgroundColor: "var(--notebook-paper)",
            boxShadow: "var(--notebook-page-shadow)",
            // The free edge softens as it lifts; the hinged edge stays square against the spine.
            borderRadius: frontRadius,
          }}
        >
          <div aria-hidden style={{ position: "absolute", inset: 0, ...PAPERS[paper] }} />
          <div
            aria-hidden
            style={{ position: "absolute", inset: 0, backgroundImage: FRONT_SHEEN[key] }}
          />
        </div>

        <div
          style={{
            position: "absolute",
            inset: 0,
            backfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
            backgroundColor: "var(--notebook-paper)",
            backgroundImage: BACK_SHADE[key],
            boxShadow: "var(--notebook-page-shadow)",
            borderRadius: backRadius,
          }}
        />
      </motion.div>
    </div>
  );
}
