"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";

/**
 * Riffling: a run of leaves flipped over in quick succession, the way a thumb finds a page.
 *
 * What the contents page does when a line far into the book is chosen. One full curl per spread in
 * between would be slow and say nothing; a riffle says "many pages, quickly" in under a second.
 * Leaves are rigid here on purpose: at this speed the eye reads the stack moving, not a sheet bending.
 *
 * Each leaf is rotated before it is pushed off the book (`rotateY` then `translateZ`), so its depth
 * offset turns over with it: the first leaf is on top of the stack before it goes, and underneath
 * the others once they have all landed, which is where a real riffle leaves it.
 */

export interface NotebookRiffleProps {
  /** Spread: leaves hinge at the spine. Single: one page, hinged at its own left edge. */
  hingeX: number;
  leafX: number;
  leafWidth: number;
  height: number;
  /** 1: right to left (forwards). -1: left to right (backwards). */
  dir: 1 | -1;
  /** Leaves to flip. A handful reads as "many"; more only takes longer. */
  count: number;
  /** What lies still underneath: the destination's uncovered page, the start's other page. */
  ground: ReactNode;
  /** The first leaf's face, the page the riffle starts from. */
  firstFront: ReactNode;
  /** The last leaf's other face, the page the riffle lands on. */
  lastBack: ReactNode;
  /** The faces of the leaves in between: plain paper, nobody can read them at this speed. */
  blank: ReactNode;
  /** Their other faces, ruled for the side they land on. */
  blankBack: ReactNode;
  /** The coil, drawn over the leaves: they turn through it. */
  top?: ReactNode;
  onDone: () => void;
}

const LEAF_MS = 340;
const STAGGER_MS = 80;
/** Depth between stacked leaves, px. Enough to never z-fight, too little to ever be seen. */
const LAYER = 0.6;

export function NotebookRiffle({
  hingeX,
  leafX,
  leafWidth,
  height,
  dir,
  count,
  ground,
  firstFront,
  lastBack,
  blank,
  blankBack,
  top,
  onDone,
}: NotebookRiffleProps) {
  const leaves = useRef<Array<HTMLDivElement | null>>([]);

  useLayoutEffect(() => {
    const turn = dir > 0 ? -180 : 180;
    const animations = leaves.current.flatMap((leaf, index) => {
      if (!leaf) return [];
      const depth = (count - index) * LAYER;
      return [
        leaf.animate(
          [
            { transform: `rotateY(0deg) translateZ(${depth}px)` },
            { transform: `rotateY(${turn}deg) translateZ(${depth}px)` },
          ],
          {
            duration: LEAF_MS,
            delay: index * STAGGER_MS,
            easing: "cubic-bezier(.45,.05,.3,1)",
            fill: "both",
          },
        ),
      ];
    });
    const last = animations[animations.length - 1];
    let cancelled = false;
    if (last) {
      last.finished
        .then(() => {
          if (!cancelled) onDone();
        })
        .catch(() => undefined);
    } else {
      onDone();
    }
    return () => {
      cancelled = true;
      for (const animation of animations) animation.cancel();
    };
    // One riffle per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const face = {
    position: "absolute" as const,
    inset: 0,
    backfaceVisibility: "hidden" as const,
    WebkitBackfaceVisibility: "hidden" as const,
    overflow: "hidden",
  };

  return (
    <div
      aria-hidden="true"
      style={{ position: "absolute", inset: 0, overflow: "hidden", perspective: 2200 }}
    >
      <div style={{ position: "absolute", inset: 0, transformStyle: "preserve-3d" }}>
        <div
          style={{
            position: "absolute",
            inset: 0,
            transform: `translateZ(${-(count + 2) * LAYER}px)`,
          }}
        >
          {ground}
        </div>
        {Array.from({ length: count }, (_, index) => (
          <div
            key={index}
            ref={(element) => {
              leaves.current[index] = element;
            }}
            style={{
              position: "absolute",
              top: 0,
              left: leafX,
              width: leafWidth,
              height,
              transformStyle: "preserve-3d",
              transformOrigin: `${hingeX - leafX}px 50%`,
              transform: `translateZ(${(count - index) * LAYER}px)`,
            }}
          >
            <div style={face}>
              {index === 0 ? firstFront : blank}
              <div className="nb-riffle-shade" data-face="front" />
            </div>
            <div style={{ ...face, transform: "rotateY(180deg)" }}>
              {index === count - 1 ? lastBack : blankBack}
              <div className="nb-riffle-shade" data-face="back" />
            </div>
          </div>
        ))}
      </div>
      {top ? (
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>{top}</div>
      ) : null}
    </div>
  );
}
