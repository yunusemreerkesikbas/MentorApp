"use client";

import { useId } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { CSSProperties, ReactNode } from "react";
import type {
  NotebookCoverColor,
  NotebookCoverDoc,
  NotebookCoverMaterial,
  NotebookPaper,
} from "@mentor/types";
import { NOTEBOOK_PAGE_CANVAS } from "@mentor/types";

/**
 * The notebook itself — paper, spiral binding and cover, drawn entirely in CSS and inline SVG.
 *
 * No raster asset, and that is not a taste call. `board-stage.tsx` keeps its backgrounds procedural
 * because the canvas exporter has to reproduce every one of them; a bitmap page would break the
 * same path here. A raster also ignores the theme and goes soft at any zoom the design space does
 * not happen to match, while a gradient is resolution-free and reads its colours from the tokens.
 *
 * Everything sizes in container-query units, so the page renders identically at any width without
 * measuring anything — same trick the board stage uses.
 */

/** Ruling rhythm in the 1080×1440 design space, expressed against the page's own width. */
const LINE_STEP = "3.4cqw";
const SPIRAL_WIDTH = "7cqw";
/** One ring per this much height. Keyed to width so the binding scales with the page, not the view. */
const RING_STEP = 5.6;
/**
 * The tile a single ring repeats in — the coil's pitch.
 *
 * At six steps the rings sat a full ring apart and the binding read as a row of separate hoops, or
 * a chain-link fence stood on end. A real coil is wound tight: the gap between turns is a fraction
 * of a turn, not a whole one. Named and shared because the cover's binding and the spread's coil
 * have to line up as the same notebook — two hand-tuned pitches drift apart on the next edit.
 */
const RING_TILE = RING_STEP * 3.2;
/** Wire gauge. Named because the cover's binding and the spread's coil must stay the same notebook. */
const WIRE_GAUGE = RING_STEP * 0.38;

/**
 * How much of a turn is in front of the paper, on an ellipse normalised to 100 units.
 *
 * 42 rather than a full half: a flatter arc, closer to what the eye actually catches of a wound
 * coil. The offset centres that arc on the top of the ellipse — the visible run is 54→96, and 75 is
 * twelve o'clock. Change the dash and this has to move with it, which is why they are one pair.
 */
const ARC_DASH = "42 58";
const ARC_OFFSET = 46;

/**
 * Spread geometry, in the page canvas's own units, so the shell's aspect ratio, the spine's width
 * and the turning leaf's flight path are all derived from one number instead of three hand-tuned
 * percentages that drift apart.
 *
 * Deliberately tight. A real spiral notebook opened flat has its two sheets almost touching, punched
 * right at their inner edges, with a compact coil running up the seam — the gutter is a channel, not
 * a gap. Widen this and the rings stretch to span it, which reads as a chain link fence rather than
 * as binding; at 34 the seam itself had enough width to read as a column of its own.
 *
 * The rings' span is a percentage of this, so narrowing the channel narrows them too — the ring and
 * hole percentages below are set against this number, and moving one without the others leaves the
 * wire ending short of the holes it is supposed to thread.
 */
export const SPINE_GUTTER = 20;
const SPREAD_SPAN = NOTEBOOK_PAGE_CANVAS.width * 2 + SPINE_GUTTER;
export const PAGE_PERCENT = (NOTEBOOK_PAGE_CANVAS.width / SPREAD_SPAN) * 100;
export const SPINE_PERCENT = (SPINE_GUTTER / SPREAD_SPAN) * 100;
/**
 * An open spread's width/height.
 *
 * Exported because the loading skeleton has to reserve exactly this shape: a skeleton that guesses
 * the book's proportions is a layout that jumps the moment the real one arrives, which is the one
 * thing a skeleton exists to prevent.
 */
export const SPREAD_RATIO = SPREAD_SPAN / NOTEBOOK_PAGE_CANVAS.height;

/** Exported so the sidebar's paper picker can render a live swatch per option, not just a label. */
export const PAPERS: Record<NotebookPaper, CSSProperties> = {
  ruled: {
    backgroundImage: `repeating-linear-gradient(180deg, transparent 0 calc(${LINE_STEP} - 1px), var(--notebook-rule) calc(${LINE_STEP} - 1px) ${LINE_STEP})`,
  },
  grid: {
    backgroundImage: `repeating-linear-gradient(180deg, transparent 0 calc(${LINE_STEP} - 1px), var(--notebook-rule) calc(${LINE_STEP} - 1px) ${LINE_STEP}), repeating-linear-gradient(90deg, transparent 0 calc(${LINE_STEP} - 1px), var(--notebook-rule) calc(${LINE_STEP} - 1px) ${LINE_STEP})`,
  },
  dotted: {
    backgroundImage:
      "radial-gradient(var(--notebook-rule) 1px, transparent 1.4px)",
    backgroundSize: `${LINE_STEP} ${LINE_STEP}`,
  },
  plain: {},
};

/**
 * The wire binding.
 *
 * Every ring is drawn as the *front half* of a turn, not a closed loop. A closed loop is what a coil
 * looks like from the side; from the front, the far half is behind the paper and you see an arc that
 * rises out of one punch hole and dives into the other. Drawn closed and wound tight, the loops'
 * left and right extremes line up down the page into two unbroken verticals — the binding stopped
 * reading as wire and started reading as a pipe.
 *
 * The half is cut with `pathLength` + a dash, not with a clip or a hand-written path: the geometry
 * here is in percentages (the rings have to span a gutter whose width is a percentage of the
 * spread), and SVG path data cannot take those. Normalising the ellipse to 100 units lets one dash
 * of 50 select exactly the upper half, whatever the ellipse's real size turns out to be.
 *
 * An SVG `<pattern>` rather than a stack of elements or a repeating gradient: the pattern tiles
 * itself to whatever height the page ends up at, so nothing has to count rings or measure the
 * container. Each ring is a closed loop bulging past the page's own left edge — the way a real
 * coil sits proud of the paper — with the punched hole painted on top of it, so the wire reads as
 * threading through the hole rather than just sitting beside it. A thin, offset highlight stroke
 * is what turns a flat tint into something that looks like metal catching light.
 */
function BindingDefs({ wire, hole }: { wire: string; hole: string }) {
  return (
    <>
      <linearGradient id={wire} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="var(--notebook-wire-dark)" />
        <stop offset="50%" stopColor="var(--notebook-wire-light)" />
        <stop offset="100%" stopColor="var(--notebook-wire-dark)" />
      </linearGradient>
      <radialGradient id={hole} cx="35%" cy="35%" r="75%">
        <stop offset="0%" stopColor="var(--notebook-hole)" />
        <stop
          offset="100%"
          stopColor="color-mix(in srgb, var(--notebook-hole) 35%, transparent)"
        />
      </radialGradient>
    </>
  );
}

function SpiralBinding() {
  // Ids are document-global; two notebooks on one screen would otherwise share one gradient.
  const id = useId();
  const wire = `${id}-wire`;
  const hole = `${id}-hole`;
  const ring = `${id}-ring`;

  return (
    <svg
      aria-hidden="true"
      width="100%"
      height="100%"
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
    >
      <defs>
        <BindingDefs wire={wire} hole={hole} />
        <pattern
          id={ring}
          width="100%"
          height={RING_TILE}
          patternUnits="userSpaceOnUse"
        >
          {/* The front half of a turn, bulging past the cover's own edge — the same arc the spread's
              binding draws, sized against this column instead of the gutter. It was the one piece of
              the coil still measured in raw units while everything around it moved to percentages,
              so the cover's rings stayed one fixed size while the spread's tracked the seam: two
              bindings drifting apart on the same notebook. */}
          <ellipse
            cx="34%"
            cy={RING_TILE / 2}
            rx="46%"
            ry={RING_TILE * 0.42}
            fill="none"
            stroke={`url(#${wire})`}
            strokeWidth={WIRE_GAUGE}
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray={ARC_DASH}
            strokeDashoffset={ARC_OFFSET}
          />
          {/* Specular highlight — offset up-left of the coil's own centre, not concentric with it. */}
          <ellipse
            cx="33%"
            cy={RING_TILE / 2 - RING_STEP * 0.22}
            rx="46%"
            ry={RING_TILE * 0.42}
            fill="none"
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray={ARC_DASH}
            strokeDashoffset={ARC_OFFSET}
            stroke="var(--notebook-wire-light)"
            strokeWidth={WIRE_GAUGE * 0.3}
            strokeOpacity="0.6"
          />
          {/* The punched hole, painted last so the coil visibly threads through it. */}
          <ellipse
            cx="70%"
            cy={RING_TILE / 2}
            rx={RING_STEP * 0.62}
            ry={RING_STEP * 0.62}
            fill={`url(#${hole})`}
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${ring})`} />
    </svg>
  );
}

/**
 * The coil that holds an open spread together.
 *
 * One binding for both pages, not one per page. A spiral notebook opened flat has a single wire down
 * the centre, and each ring crosses the gutter to thread through a hole punched in the facing edge of
 * *both* sheets — that crossing is the whole reason the two pages read as one book rather than two
 * cards side by side.
 *
 * So the SVG deliberately overhangs its own column (`left: -50%`, `width: 200%`): the rings need to
 * reach onto the paper, and the holes need to land on the pages' punched edges, not in the empty
 * gutter between them. It sits above both pages so the wire passes over the paper, as a coil does.
 *
 * The overhang is a multiple of the gutter on purpose — the coil then stays proportional to the seam
 * it binds at every notebook size, instead of needing a second number tuned against the first.
 *
 * The ring rhythm is shared with `SpiralBinding` (same `RING_STEP`, same tile height, both anchored
 * at the top of the spread), so the cover's binding and the spread's line up as the same notebook.
 */
export function NotebookSpine() {
  const id = useId();
  const wire = `${id}-wire`;
  const hole = `${id}-hole`;
  const ring = `${id}-ring`;

  return (
    <div
      aria-hidden="true"
      style={{
        position: "relative",
        height: "100%",
        width: `${SPINE_PERCENT}%`,
        flexShrink: 0,
        zIndex: 2,
        // The channel between the sheets, not a hole through to the app background: paper, shaded
        // darkest at each lip where the page curves down into the binding.
        backgroundColor: "var(--notebook-paper)",
        // Softer than it was. The lips only need to say the paper curves down into the seam; at the
        // old strength the shading itself drew a dark column, which added to the pipe the closed
        // rings were already making.
        backgroundImage:
          "linear-gradient(90deg, rgba(0,0,0,0.11), rgba(0,0,0,0.03) 42%, rgba(0,0,0,0.03) 58%, rgba(0,0,0,0.11))",
      }}
    >
      <svg
        width="200%"
        height="100%"
        style={{
          position: "absolute",
          top: 0,
          left: "-50%",
          pointerEvents: "none",
        }}
      >
        <defs>
          <BindingDefs wire={wire} hole={hole} />
          <pattern
            id={ring}
            width="100%"
            height={RING_TILE}
            patternUnits="userSpaceOnUse"
          >
            {/* One ring, arcing across the gutter and just past the hole on either side. */}
            <ellipse
              cx="50%"
              cy={RING_TILE / 2}
              rx="50%"
              ry={RING_TILE * 0.42}
              fill="none"
              stroke={`url(#${wire})`}
              strokeWidth={WIRE_GAUGE}
              strokeLinecap="round"
              pathLength={100}
              strokeDasharray={ARC_DASH}
              strokeDashoffset={ARC_OFFSET}
            />
            {/* Specular highlight, offset up-left of the coil rather than concentric with it. */}
            <ellipse
              cx="49%"
              cy={RING_TILE / 2 - RING_STEP * 0.22}
              rx="50%"
              ry={RING_TILE * 0.42}
              fill="none"
              strokeLinecap="round"
              pathLength={100}
              strokeDasharray={ARC_DASH}
              strokeDashoffset={ARC_OFFSET}
              stroke="var(--notebook-wire-light)"
              strokeWidth={WIRE_GAUGE * 0.3}
              strokeOpacity="0.6"
            />
            {/* The two punched holes, painted last so the wire visibly threads through them. Sitting
                just inside the ring's own span puts them on the pages' punched edges, where a real
                notebook punches them, rather than out in the middle of the paper. */}
            <ellipse
              cx="8%"
              cy={RING_TILE / 2}
              rx={RING_STEP * 0.62}
              ry={RING_STEP * 0.62}
              fill={`url(#${hole})`}
            />
            <ellipse
              cx="92%"
              cy={RING_TILE / 2}
              rx={RING_STEP * 0.62}
              ry={RING_STEP * 0.62}
              fill={`url(#${hole})`}
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${ring})`} />
      </svg>
    </div>
  );
}

export interface NotebookPageSurfaceProps {
  paper: NotebookPaper;
  /**
   * Which edge carries the binding margin. `"right"` is the left half of a spread — its bound edge
   * faces the spine, so ruling, margin rule and content all mirror.
   */
  binding?: "left" | "right";
  /**
   * False when the page is half of a spread: `NotebookSpine` draws one coil across both pages, so
   * the page keeps its punched margin but draws no wire of its own.
   */
  coil?: boolean;
  /** The page's own content — the board stage, in practice. */
  children?: ReactNode;
  className?: string;
}

/**
 * One page: paper, ruling, the binding down its left edge, and a content well clear of the rings.
 *
 * `container-type: inline-size` is what lets every length above be a share of the page's width, so
 * the same markup is a phone page and a desktop page with no breakpoint anywhere.
 */
export function NotebookPageSurface({
  paper,
  binding = "left",
  coil = true,
  children,
  className,
}: NotebookPageSurfaceProps) {
  // One flag drives ruling inset, margin rule, coil column and content padding together, so a page
  // can never end up ruled for one edge and padded for the other.
  const bound = binding === "left" ? "Left" : "Right";

  return (
    <div
      className={className}
      style={{
        containerType: "inline-size",
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        backgroundColor: "var(--notebook-paper)",
        boxShadow: "var(--notebook-page-shadow)",
      }}
    >
      {/*
        Ruling sits under the content and stops short of the binding margin — and it crossfades
        rather than snapping, because the ruling *is* the page's texture: swapping it in one frame
        reads as a rendering glitch, while a fade reads as the sheet itself changing. Keyed on
        `paper`, so the outgoing pattern and the margin rule that belongs to it leave together.

        An opacity crossfade needs no `prefers-reduced-motion` branch — it is already the reduced
        alternative to motion, not motion itself.
      */}
      <AnimatePresence initial={false}>
        <motion.div
          key={paper}
          aria-hidden="true"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          style={{ position: "absolute", inset: 0 }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              [`margin${bound}`]: SPIRAL_WIDTH,
              ...PAPERS[paper],
            }}
          />
          {/* The margin rule — the red line every Turkish exercise book has. */}
          {paper === "ruled" ? (
            <div
              style={{
                position: "absolute",
                top: 0,
                bottom: 0,
                [binding]: `calc(${SPIRAL_WIDTH} + 4cqw)`,
                width: "1px",
                backgroundColor: "var(--notebook-margin-rule)",
              }}
            />
          ) : null}
        </motion.div>
      </AnimatePresence>
      {coil ? (
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            [binding]: 0,
            width: SPIRAL_WIDTH,
          }}
        >
          <SpiralBinding />
        </div>
      ) : null}
      <div
        style={{
          position: "absolute",
          inset: 0,
          [`padding${bound}`]: `calc(${SPIRAL_WIDTH} + 5cqw)`,
        }}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * The cover palette.
 *
 * Literal hex, not theme tokens — the same call the ink pens make, and for the same reason: these
 * are not surfaces the theme owns, they are content the student picked. A palette that rotated in
 * dark mode would repaint somebody's burgundy notebook green overnight.
 *
 * None of them needs a matching text colour: the title is printed on a cream label plate stuck to
 * the cover, not on the cover itself, so a new colour can be added here and nothing else.
 */
export const COVER_COLORS: Record<NotebookCoverColor, string> = {
  navy: "#33415c",
  plum: "#5a3550",
  forest: "#2f4a3c",
  sand: "#c9b28f",
  slate: "#5b6472",
  ink: "#22262e",
};

/**
 * A grain layer, generated rather than fetched.
 *
 * `feTurbulence` is what a photograph of leather or kraft would have been here, minus the asset,
 * the second asset for retina, the bucket and the decode. It is one filter over an empty rect,
 * inlined as a data URI, and it resolves at whatever size the book happens to be drawn at — which
 * matters, because the book is sized continuously by `useFitSize` and never lands on a round number.
 */
function grain(frequency: number, opacity: number): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='g'><feTurbulence type='fractalNoise' baseFrequency='${frequency}' numOctaves='3'/></filter><rect width='120' height='120' filter='url(%23g)' opacity='${opacity}'/></svg>`;
  return `url("data:image/svg+xml,${svg.replace(/"/g, "'").replace(/#/g, "%23")}")`;
}

/**
 * How each finish is built, over the flat colour underneath it.
 *
 * Ordered front to back, the way `background-image` stacks: the highlight that says "this is a
 * curved object catching light" always sits on top, the material's own texture under it.
 */
export const COVER_MATERIALS: Record<NotebookCoverMaterial, string> = {
  // The original: a woven cross-hatch, tight enough to read as bookcloth rather than as a pattern.
  cloth:
    "radial-gradient(120% 90% at 15% 0%, rgba(255,255,255,0.16), transparent 60%), repeating-linear-gradient(45deg, rgba(255,255,255,0.05) 0 2px, transparent 2px 4px), repeating-linear-gradient(-45deg, rgba(0,0,0,0.05) 0 2px, transparent 2px 4px)",
  // Coarser and warmer: board stock, with the fibre showing through.
  kraft: `radial-gradient(120% 90% at 15% 0%, rgba(255,255,255,0.12), transparent 55%), ${grain(
    0.9,
    0.5,
  )}`,
  // Fine irregular grain plus a broader sheen — the two things that read as hide rather than cloth.
  leather: `radial-gradient(130% 100% at 20% 0%, rgba(255,255,255,0.2), transparent 62%), linear-gradient(160deg, rgba(0,0,0,0.18), transparent 45%), ${grain(
    1.6,
    0.35,
  )}`,
  // No texture at all. Somebody will want the plain one, and "no texture" is a finish.
  matte:
    "radial-gradient(120% 90% at 18% 0%, rgba(255,255,255,0.13), transparent 58%)",
};

/** What the book looks like when nobody has chosen anything — the cover it has always had. */
export const DEFAULT_COVER: NotebookCoverDoc = {
  color: "navy",
  material: "cloth",
};

export interface NotebookCoverProps {
  /** The app's own name for the book; overridden by whatever the student wrote on the cover. */
  title: string;
  subtitle?: string;
  /** Absent on a book whose first page has not loaded yet, which is when the default is right. */
  cover?: NotebookCoverDoc | null;
  children?: ReactNode;
  /** Present → the whole cover opens the book, with the accessible name a screen reader announces. */
  onOpen?: () => void;
  openLabel?: string;
}

/**
 * The cover the book opens on.
 *
 * Deliberately not a photo of a notebook: the texture is two gradients (a cloth weave and a corner
 * sheen), so it recolours with the theme and stays crisp at any size. If it ever reads as cheap the
 * fix is one SVG texture layer on top, not a full-page image.
 *
 * The whole surface is the open control, not a button floating on top of it — there is no separate
 * "open" affordance once the cover itself so plainly is one. Keyboard and screen-reader users get
 * the same control via `role="button"` + `tabIndex`, named by `openLabel`.
 */
export function NotebookCover({
  title,
  subtitle,
  children,
  cover,
  onOpen,
  openLabel,
}: NotebookCoverProps) {
  const chosen = cover ?? DEFAULT_COVER;

  return (
    <div
      role={onOpen ? "button" : undefined}
      tabIndex={onOpen ? 0 : undefined}
      aria-label={onOpen ? openLabel : undefined}
      onClick={onOpen}
      onKeyDown={
        onOpen
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onOpen();
              }
            }
          : undefined
      }
      style={{
        containerType: "inline-size",
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        cursor: onOpen ? "pointer" : undefined,
        backgroundColor: COVER_COLORS[chosen.color],
        backgroundImage: COVER_MATERIALS[chosen.material],
        boxShadow: "var(--notebook-page-shadow)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: "2cqw",
        paddingLeft: `calc(${SPIRAL_WIDTH} + 8cqw)`,
        paddingRight: "8cqw",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: 0,
          width: SPIRAL_WIDTH,
        }}
      >
        <SpiralBinding />
      </div>
      {/* The stuck-on label every notebook cover carries. */}
      <div
        style={{
          alignSelf: "flex-start",
          maxWidth: "100%",
          padding: "4cqw 5cqw",
          borderRadius: "var(--radius-card)",
          backgroundColor: "var(--notebook-label)",
          transform: "rotate(-1.2deg)",
          boxShadow: "0 2px 10px rgba(0,0,0,0.14)",
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: "6cqw",
            fontWeight: 700,
            lineHeight: 1.15,
            color: "var(--color-main)",
          }}
        >
          {title}
        </p>
        {subtitle ? (
          <p
            style={{
              margin: "1.5cqw 0 0",
              fontSize: "3.4cqw",
              color: "var(--color-secondary)",
            }}
          >
            {subtitle}
          </p>
        ) : null}
      </div>
      {children}
    </div>
  );
}
