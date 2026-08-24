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
 * ponytail: the curl is shading, not geometry — a rigid sheet, a sheen/crease gradient, a lift out
 * of the binding and a bow. Bending it for real was tried: a chain of ten vertical slices, each
 * hinged on the free edge of the one before it, like a folding rule. It reads convincingly while the
 * leaf stands up and falls apart once it lies down, which is where a turning page spends most of its
 * time. Two artefacts, neither fixable from inside the technique:
 *
 * - Neighbouring slices sit at different angles to the viewer, so perspective foreshortens each one
 *   differently and the horizontal rulings kink at every seam. Flattening the sheet hides it; laying
 *   it down opens it. More slices shrink each kink and add seams; fewer do the opposite.
 * - Any shading has to be cut into ten pieces that line up, and the back face is mirrored by its own
 *   `rotateY(180deg)`, so a windowed gradient comes out reversed inside each slice. Flat per-slice
 *   tints avoid that and become the banding themselves — ten steps read as ten steps on a surface
 *   this large, not as a falloff.
 *
 * Real deformation needs WebGL or a canvas page-flip library, and both want to own the DOM our
 * interactive stages already live in. What survived the experiment is everything that cost nothing:
 * the leaf lifts off the book, and both of its faces are ruled the way a real page is.
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

/** How far the leaf lifts off the book at the top of its arc. Clipped by the book's own overflow. */
const LIFT_PX = 14;

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

/** Back face: the underside of the sheet — the grey falloff of the curl, over the same ruling. */
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

export function NotebookPageTurn({
  dir,
  paper,
  single,
  onDone,
}: NotebookPageTurnProps) {
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
        transition={{
          duration: PAGE_TURN_SECONDS,
          times: [0, 0.55, 1],
          ease: "easeInOut",
        }}
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
          // The ruling is sized in `cqw`, and `cqw` resolves against the nearest container — so it
          // has to be declared once here, on the whole leaf. Declared per slice (as it was when the
          // sheet was one rigid face) every slice becomes its own container and the lines come out
          // ten times too dense, because each slice is a tenth of a page wide.
          containerType: "inline-size",
        }}
        initial={{ rotateY: 0, scaleY: 1, z: 0 }}
        // `scaleY` is the bow: a sheet standing on its edge is momentarily shorter than one lying
        // flat. `z` lifts the whole leaf off the book at the top of its arc — a page being turned
        // rises out of the binding rather than sweeping flat across it.
        animate={{
          rotateY: forward ? -180 : 180,
          scaleY: [1, 0.952, 1],
          z: [0, LIFT_PX, 0],
        }}
        transition={{
          rotateY: { duration: PAGE_TURN_SECONDS, ease: [0.45, 0.05, 0.25, 1] },
          scaleY: {
            duration: PAGE_TURN_SECONDS,
            times: [0, 0.5, 1],
            ease: "easeInOut",
          },
          z: {
            duration: PAGE_TURN_SECONDS,
            times: [0, 0.5, 1],
            ease: "easeInOut",
          },
        }}
        onAnimationComplete={onDone}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            backfaceVisibility: "hidden",
            overflow: "hidden",
            backgroundColor: "var(--notebook-paper)",
            boxShadow: "var(--notebook-page-shadow)",
            // The free edge softens as it lifts; the hinged edge stays square against the spine.
            borderRadius: frontRadius,
          }}
        >
          <div
            aria-hidden
            style={{ position: "absolute", inset: 0, ...PAPERS[paper] }}
          />
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: FRONT_SHEEN[key],
            }}
          />
        </div>

        <div
          style={{
            position: "absolute",
            inset: 0,
            backfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
            overflow: "hidden",
            backgroundColor: "var(--notebook-paper)",
            boxShadow: "var(--notebook-page-shadow)",
            borderRadius: backRadius,
          }}
        >
          {/* Ruled, like the front: a notebook page is ruled on both sides, and a blank underside
              was the loudest thing about the old turn — the leaf changed material halfway round.
              Mirrored by this face's own rotation, which horizontal rulings cannot show. */}
          <div
            aria-hidden
            style={{ position: "absolute", inset: 0, ...PAPERS[paper] }}
          />
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: BACK_SHADE[key],
            }}
          />
        </div>
      </motion.div>
    </div>
  );
}
