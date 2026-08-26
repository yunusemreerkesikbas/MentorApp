import { getStroke } from "perfect-freehand";
import type { NotebookInkStroke, NotebookInkTool } from "@mentor/types";

/**
 * The ink engine: samples in, SVG path out, plus the maths the eraser and the store need.
 *
 * Everything here is pure and DOM-free on purpose — `apps/web/vitest.config.ts` only runs
 * `src/**\/*.spec.ts` in a Node environment, so this is the layer that can actually be tested.
 * The pointer plumbing lives in `use-ink-draw.ts` and the rendering in `notebook-ink-layer.tsx`.
 *
 * Coordinates throughout are the notebook page's own 1080×1527 A4 design space, never screen px.
 */

/** `[x, y, pressure]` per sample — see `NotebookInkStroke` for why the stored array is flat. */
const STRIDE = 3;

/**
 * One slider range for every pen rather than per-tool ranges. The tools differ by *default*, which
 * is what makes them feel different; a highlighter you can thin to a hairline is a fine thing to
 * allow and a second pair of bounds per tool is upkeep nobody asked for.
 *
 * Design-space px: the page is 1080 wide and renders around 480 on a phone, so a size of 8 lands
 * near 3.5 real px — a ballpoint.
 */
export const INK_SIZE_MIN = 2;
export const INK_SIZE_MAX = 60;

/** How far from the cursor the eraser bites, before the stroke's own width is added. */
export const ERASER_RADIUS = 14;

/**
 * Ramer–Douglas–Peucker tolerance, in design-space px. Under half a nib width, so simplification
 * is invisible while still throwing away most of a pointer's samples.
 */
const SIMPLIFY_EPSILON = 0.75;

export interface InkPreset {
  /** Default nib width in design-space px. */
  size: number;
  /** Default opacity — the highlighter is the only one that starts translucent. */
  opacity: number;
  /** How much velocity narrows the line. 0 keeps a constant width. */
  thinning: number;
  smoothing: number;
  streamline: number;
  taperStart: number;
  taperEnd: number;
  /** `multiply` lets a highlighter pass over text without hiding it. */
  blend: "normal" | "multiply";
  /**
   * Fountain pen only. A calligraphy nib's width comes from the angle between the stroke and a
   * fixed nib direction, which `thinning` (velocity and pressure) cannot express at all — so the
   * one tool that has this uses `nibOutline` instead of perfect-freehand.
   */
  nibAngle?: number;
}

export const INK_TOOLS: Record<NotebookInkTool, InkPreset> = {
  // Soft and grainy-looking: narrows hard with speed, so quick strokes read as light passes.
  pencil: {
    size: 5,
    opacity: 0.85,
    thinning: 0.62,
    smoothing: 0.55,
    streamline: 0.45,
    taperStart: 0,
    taperEnd: 12,
    blend: "normal",
  },
  // The default. A ballpoint: mostly even, with just enough life at the ends.
  pen: {
    size: 8,
    opacity: 1,
    thinning: 0.4,
    smoothing: 0.5,
    streamline: 0.5,
    taperStart: 0,
    taperEnd: 0,
    blend: "normal",
  },
  // Technical pen — dead constant width, the one you underline with.
  fineliner: {
    size: 4,
    opacity: 1,
    thinning: 0,
    smoothing: 0.4,
    streamline: 0.55,
    taperStart: 0,
    taperEnd: 0,
    blend: "normal",
  },
  // Chisel marker: broad, flat, barely any velocity response.
  marker: {
    size: 20,
    opacity: 0.95,
    thinning: 0.08,
    smoothing: 0.35,
    streamline: 0.5,
    taperStart: 0,
    taperEnd: 0,
    blend: "normal",
  },
  // Wide, translucent, multiplied — the one meant to go *over* a question, not next to it.
  highlighter: {
    size: 36,
    opacity: 0.38,
    thinning: 0,
    smoothing: 0.3,
    streamline: 0.6,
    taperStart: 0,
    taperEnd: 0,
    blend: "multiply",
  },
  // Heaviest velocity response plus tapers at both ends: the expressive one.
  brush: {
    size: 18,
    opacity: 1,
    thinning: 0.78,
    smoothing: 0.6,
    streamline: 0.4,
    taperStart: 18,
    taperEnd: 26,
    blend: "normal",
  },
  // Italic nib held at the usual 45°: thick across the stroke, hairline along it.
  fountain: {
    size: 14,
    opacity: 1,
    thinning: 0,
    smoothing: 0.5,
    streamline: 0.5,
    taperStart: 0,
    taperEnd: 0,
    blend: "normal",
    nibAngle: 45,
  },
};

/**
 * The swatches.
 *
 * Literal hex rather than design tokens, for the same reason
 * `notebook-side-panel.tsx` keeps its own `NOTE_PLATE_COLORS`: these are not chrome the theme owns,
 * they are content the student picks. A palette that restyled itself in dark mode would repaint
 * ink somebody already drew.
 *
 * Ordered greyscale → warm → cool so the strip reads as a spectrum rather than a bag of colours.
 */
export const INK_PALETTE = [
  "#111111",
  "#5c5c5c",
  "#9a9a9a",
  "#ffffff",
  "#8b1a12",
  "#e0342a",
  "#f26722",
  "#f5a623",
  "#ffd600",
  "#8bc34a",
  "#2e7d54",
  "#14b8a6",
  "#0e9fd6",
  "#2563eb",
  "#5b3df5",
  "#a855f7",
  "#ec4899",
] as const;

/** Where a fresh page starts: the pen, in ink-black. */
export const INK_DEFAULT_COLOR: string = INK_PALETTE[0];
export const INK_DEFAULT_TOOL: NotebookInkTool = "pen";

/**
 * What the toolbar can have selected.
 *
 * The eraser sits in the same row as the pens and is chosen the same way, but it is not a
 * `NotebookInkTool`: it draws nothing, so nothing it does is ever stored. Keeping it out of the
 * persisted enum is what stops "eraser" ever appearing as a saved stroke's tool.
 */
export type InkToolId = NotebookInkTool | "eraser";

export const INK_TOOL_ORDER: readonly InkToolId[] = [
  "pencil",
  "pen",
  "fineliner",
  "marker",
  "highlighter",
  "brush",
  "fountain",
  "eraser",
];

export interface InkBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Flat storage array → the `[x, y, pressure]` tuples perfect-freehand and the nib both want. */
function toSamples(points: number[]): [number, number, number][] {
  const samples: [number, number, number][] = [];
  for (let i = 0; i + STRIDE <= points.length; i += STRIDE) {
    samples.push([points[i], points[i + 1], points[i + 2]]);
  }
  return samples;
}

/**
 * An outline polygon → an SVG `d`.
 *
 * Quadratics through the midpoints rather than straight segments: the outline has a vertex per
 * input sample, and joining them with lines makes a fast stroke visibly faceted.
 */
function outlineToPath(outline: number[][]): string {
  if (outline.length < 2) return "";
  const parts: (string | number)[] = ["M", outline[0][0], outline[0][1], "Q"];
  for (let i = 0; i < outline.length; i += 1) {
    const [x0, y0] = outline[i];
    const [x1, y1] = outline[(i + 1) % outline.length];
    parts.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
  }
  parts.push("Z");
  return parts.join(" ");
}

/**
 * A fixed-angle calligraphy nib.
 *
 * The nib is a line segment of length `size` held at `angleDeg` and dragged along the path, so the
 * outline is simply the path offset by ±half that segment: one side out, the other side back.
 * Where the stroke runs parallel to the nib the two sides collapse onto each other and the line
 * goes hairline-thin — which is the entire behaviour a fountain pen is recognised by, and the one
 * thing perfect-freehand's velocity model cannot produce.
 */
export function nibOutline(
  samples: [number, number, number][],
  size: number,
  angleDeg: number,
): number[][] {
  const radians = (angleDeg * Math.PI) / 180;
  const dx = (Math.cos(radians) * size) / 2;
  const dy = (Math.sin(radians) * size) / 2;
  const forward = samples.map(([x, y]) => [x + dx, y + dy]);
  const back = samples.map(([x, y]) => [x - dx, y - dy]).reverse();
  return [...forward, ...back];
}

/** One stored stroke → the SVG path that draws it. Empty string for a stroke with no samples. */
export function strokeToPath(stroke: NotebookInkStroke): string {
  const samples = toSamples(stroke.points);
  if (samples.length === 0) return "";

  const preset = INK_TOOLS[stroke.tool];
  if (preset.nibAngle !== undefined) {
    return outlineToPath(nibOutline(samples, stroke.size, preset.nibAngle));
  }

  return outlineToPath(
    getStroke(samples, {
      size: stroke.size,
      thinning: preset.thinning,
      smoothing: preset.smoothing,
      streamline: preset.streamline,
      // A mouse reports pressure 0, and a finger reports a constant — velocity is the only signal
      // most of our users will ever produce, so the simulation stays on and pressure, when a
      // stylus does send it, refines the result rather than replacing it.
      simulatePressure: true,
      start: { taper: preset.taperStart, cap: true },
      end: { taper: preset.taperEnd, cap: true },
      last: true,
    }),
  );
}

/** Perpendicular distance from a point to a segment — the eraser's whole geometry. */
function distanceToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const abx = bx - ax;
  const aby = by - ay;
  const lengthSquared = abx * abx + aby * aby;
  // A zero-length segment is a dot (a tap), so fall back to the distance to the point itself.
  const t =
    lengthSquared === 0
      ? 0
      : Math.max(
          0,
          Math.min(1, ((px - ax) * abx + (py - ay) * aby) / lengthSquared),
        );
  const cx = ax + t * abx;
  const cy = ay + t * aby;
  return Math.hypot(px - cx, py - cy);
}

/** The stroke's samples padded by its own half-width — the cheap reject before `hitStroke`. */
export function strokeBounds(stroke: NotebookInkStroke): InkBounds {
  const pad = stroke.size / 2;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i + STRIDE <= stroke.points.length; i += STRIDE) {
    const x = stroke.points[i];
    const y = stroke.points[i + 1];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return {
    minX: minX - pad,
    minY: minY - pad,
    maxX: maxX + pad,
    maxY: maxY + pad,
  };
}

/**
 * Does the eraser at `(x, y)` touch this stroke?
 *
 * Segment distance, not sample distance: a fast stroke can leave its samples 40 design-px apart,
 * and comparing against samples alone would let the eraser pass straight through the gaps.
 */
export function hitStroke(
  stroke: NotebookInkStroke,
  x: number,
  y: number,
  radius: number,
): boolean {
  const samples = toSamples(stroke.points);
  if (samples.length === 0) return false;

  const bounds = strokeBounds(stroke);
  if (
    x < bounds.minX - radius ||
    x > bounds.maxX + radius ||
    y < bounds.minY - radius ||
    y > bounds.maxY + radius
  ) {
    return false;
  }

  // The nib's half-width counts: a wide highlighter should be catchable anywhere on the band it
  // actually painted, not only along its centre line.
  const reach = radius + stroke.size / 2;
  if (samples.length === 1) {
    return Math.hypot(x - samples[0][0], y - samples[0][1]) <= reach;
  }
  for (let i = 0; i < samples.length - 1; i += 1) {
    const [ax, ay] = samples[i];
    const [bx, by] = samples[i + 1];
    if (distanceToSegment(x, y, ax, ay, bx, by) <= reach) return true;
  }
  return false;
}

/**
 * Ramer–Douglas–Peucker over the (x, y) of a flat sample array.
 *
 * Kept samples carry their own pressure across untouched — interpolating a new one for a point
 * that was really recorded would be inventing data the pen never sent.
 */
export function simplifyPoints(points: number[], epsilon: number): number[] {
  const samples = toSamples(points);
  if (samples.length <= 2) return [...points];

  const keep = new Array<boolean>(samples.length).fill(false);
  keep[0] = true;
  keep[samples.length - 1] = true;

  // Explicit stack rather than recursion: a long stroke is thousands of samples deep in the worst
  // case, and this runs on the main thread when the pointer lifts.
  const stack: [number, number][] = [[0, samples.length - 1]];
  while (stack.length > 0) {
    const [first, last] = stack.pop()!;
    let furthest = -1;
    let furthestDistance = epsilon;
    for (let i = first + 1; i < last; i += 1) {
      const distance = distanceToSegment(
        samples[i][0],
        samples[i][1],
        samples[first][0],
        samples[first][1],
        samples[last][0],
        samples[last][1],
      );
      if (distance > furthestDistance) {
        furthest = i;
        furthestDistance = distance;
      }
    }
    if (furthest !== -1) {
      keep[furthest] = true;
      stack.push([first, furthest], [furthest, last]);
    }
  }

  const out: number[] = [];
  for (let i = 0; i < samples.length; i += 1) {
    if (keep[i]) out.push(samples[i][0], samples[i][1], samples[i][2]);
  }
  return out;
}

/**
 * Turn a gesture's raw samples into what actually gets stored: simplified, then rounded.
 *
 * That order matters — simplifying first means the tolerance is judged against the real path, and
 * rounding after is free precision the document does not have to carry. Between them they are most
 * of the reason a page of drawing fits in the ink budget.
 *
 * Returns `null` when there is nothing to store; a lone sample becomes two, because one point is
 * not a stroke to either outline algorithm and the schema rejects it outright — but a deliberate
 * tap should still leave a dot.
 */
export function finalizeStroke(points: number[]): number[] | null {
  if (points.length < STRIDE) return null;

  const simplified = simplifyPoints(points, SIMPLIFY_EPSILON);
  const rounded: number[] = [];
  for (let i = 0; i + STRIDE <= simplified.length; i += STRIDE) {
    rounded.push(
      Math.round(simplified[i] * 10) / 10,
      Math.round(simplified[i + 1] * 10) / 10,
      Math.round(simplified[i + 2] * 100) / 100,
    );
  }

  if (rounded.length === STRIDE) {
    return [...rounded, ...rounded];
  }
  return rounded;
}
