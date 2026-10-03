/**
 * The desk scene's arithmetic: where a notebook lies, how thick it is, and the timeline of the
 * moment it is lifted off the desk and opened.
 *
 * Kept out of the components because none of it needs React, and all of it is the kind of number
 * that drifts when it lives inline: the tilt the desk book is drawn at has to be the same tilt the
 * flying copy starts from, or the lift begins with a jump.
 */

export interface DeskRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A notebook's resting pose on the desk: a small, stable spin and nudge so the books look put down by hand. */
export interface DeskPose {
  /** Degrees around the desk's normal. */
  rotate: number;
  /** Nudge inside the grid cell, as a share of the cell width (−1…1 maps to ±DESK_NUDGE). */
  dx: number;
  dy: number;
}

/** How far the desk is tilted away from the viewer. Shared by the desk book and its flying copy. */
export const DESK_TILT_DEG = 34;
/** The camera distance the desk books are drawn with. Shorter reads as a toy; longer reads flat. */
export const DESK_PERSPECTIVE_PX = 1300;
/** Largest spin a resting notebook gets, either way. More than this and the grid reads as a mess. */
export const DESK_MAX_SPIN_DEG = 5;
/** Largest nudge out of the grid line, as a share of the cell. */
export const DESK_NUDGE = 0.05;

/** Cover proportions: one page of the notebook's own canvas (1080 × 1527). */
export const DESK_BOOK_RATIO = 1080 / 1527;

/**
 * FNV-1a over the id. A notebook keeps the same pose across visits and renders: the desk is the
 * student's, and books that reshuffle themselves on every refresh would say nobody lives here.
 */
export function hashSeed(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** A deterministic 0…1 stream from one seed (mulberry32). */
function seeded(seed: number): () => number {
  let state = seed || 1;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function deskPose(id: string): DeskPose {
  const next = seeded(hashSeed(id));
  const spin = (next() * 2 - 1) * DESK_MAX_SPIN_DEG;
  return {
    // Never perfectly square: a book at exactly 0° reads as a UI card dropped onto wood.
    rotate: Math.abs(spin) < 1 ? (spin < 0 ? -1.2 : 1.2) : Number(spin.toFixed(2)),
    dx: Number((next() * 2 - 1).toFixed(3)),
    dy: Number((next() * 2 - 1).toFixed(3)),
  };
}

/**
 * Page-block thickness as a share of the book's width (cqw units).
 *
 * Grows with the pages actually written, so a notebook the student has filled looks it, and stops
 * at a ceiling well before it turns into a brick.
 */
export function deskBookThickness(pageCount: number): number {
  const pages = Math.max(0, Math.floor(pageCount));
  return Number(Math.min(7.2, 2.6 + pages * 0.36).toFixed(2));
}

/** The coloured index tabs a mistake notebook grows: one per due card, at most five. */
export function deskDueTabs(dueCount: number): number {
  return Math.max(0, Math.min(5, Math.floor(dueCount)));
}

/**
 * The washi-tape colour a subject gets. Exam-agnostic on purpose: the palette knows nothing about
 * KPSS subjects, only that the same subject should always get the same tape.
 */
export const DESK_TAPE_COLORS = [
  "#8fbef0",
  "#9fd6ad",
  "#f0aab3",
  "#f0cd8c",
  "#c3b5f2",
  "#9ad8d0",
] as const;

export function deskTapeColor(subjectKey: string): string {
  return DESK_TAPE_COLORS[hashSeed(subjectKey) % DESK_TAPE_COLORS.length];
}

/**
 * The lift-and-open moment: beats in milliseconds from the click.
 *
 * DESIGN.md §9.1 caps a Moment at 600 ms. This one is a scoped exception (2026-10-01, decided with
 * the product owner): about 1.5 s, springs may overshoot, and a tap anywhere skips to the end.
 * Everything else on the screen keeps the ordinary budget.
 */
export const NOTEBOOK_OPENING = {
  pressMs: 120,
  liftMs: 420,
  liftAtMs: 120,
  flyAtMs: 470,
  flyMs: 640,
  openAtMs: 900,
  openMs: 620,
  /** Navigation starts while the book is in the air, so the editor loads under the flight. */
  navigateAtMs: 520,
  settleMs: 320,
  fadeMs: 240,
  /** If the editor never says it is ready, the overlay still leaves. */
  readyTimeoutMs: 3600,
  /** The fly overshoots a little (≈ 6 %), the one place the scene allows a spring's overshoot. */
  flyEase: "cubic-bezier(.22,1.18,.32,1)",
  liftEase: "cubic-bezier(.2,.8,.25,1)",
  openEase: "cubic-bezier(.35,.05,.18,1)",
  settleEase: "cubic-bezier(.2,.8,.2,1)",
} as const;

/**
 * Where the closed book flies to: a cover whose spread, once opened, sits centred in `frame`.
 *
 * The cover opens to the left around its spine, so the closed book's left edge is the spread's
 * centre line. `chrome` reserves room for the editor's own top and bottom rows.
 */
export function deskFlyTarget(
  frame: DeskRect,
  chrome: { top: number; bottom: number; side: number } = {
    top: 72,
    bottom: 72,
    side: 32,
  },
): DeskRect {
  const availableWidth = Math.max(0, frame.width - chrome.side * 2);
  const availableHeight = Math.max(0, frame.height - chrome.top - chrome.bottom);
  // Two pages side by side: spread width = 2 × page width.
  const byHeight = availableHeight * DESK_BOOK_RATIO;
  const pageWidth = Math.max(0, Math.min(byHeight, availableWidth / 2));
  const pageHeight = pageWidth / DESK_BOOK_RATIO;
  const centreX = frame.x + frame.width / 2;
  const top = frame.y + chrome.top + (availableHeight - pageHeight) / 2;
  return { x: centreX, y: top, width: pageWidth, height: pageHeight };
}

/**
 * The single-page variant for phones: one leaf filling the frame, bound at its left edge, so the
 * cover swings off-screen to the left and the first page is what stays.
 */
export function deskFlyTargetSingle(
  frame: DeskRect,
  chrome: { top: number; bottom: number; side: number } = {
    top: 64,
    bottom: 64,
    side: 12,
  },
): DeskRect {
  const availableWidth = Math.max(0, frame.width - chrome.side * 2);
  const availableHeight = Math.max(0, frame.height - chrome.top - chrome.bottom);
  const pageWidth = Math.max(0, Math.min(availableWidth, availableHeight * DESK_BOOK_RATIO));
  const pageHeight = pageWidth / DESK_BOOK_RATIO;
  return {
    x: frame.x + (frame.width - pageWidth) / 2,
    y: frame.y + chrome.top + (availableHeight - pageHeight) / 2,
    width: pageWidth,
    height: pageHeight,
  };
}
