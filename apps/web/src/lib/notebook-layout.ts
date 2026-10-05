import {
  NOTEBOOK_PAGE_CANVAS,
  type NotebookPageItem,
  type VisionSticker,
} from "@mentor/types";

/**
 * Where a freshly added mistake card lands on the page.
 *
 * Cards are placed for the user rather than dropped at the origin for them to sort out: adding a
 * mistake happens right after getting one wrong, which is the worst moment to ask somebody to do
 * layout. They can rearrange later — the placement only has to be somewhere sensible.
 *
 * All numbers are absolute px in the 1080×1527 (A4) design space, the same convention the board items
 * use, so nothing here needs to know the rendered size.
 */

/** Clear of the spiral binding and the margin rule (7cqw + 5cqw of the page width). */
export const ENTRY_LEFT = Math.round(NOTEBOOK_PAGE_CANVAS.width * 0.16);
export const ENTRY_WIDTH = Math.round(NOTEBOOK_PAGE_CANVAS.width * 0.74);
/** A text-only mistake has no ratio to follow, so it gets the one shape that is not a photo's. */
export const ENTRY_HEIGHT = 300;
/**
 * How tall a placed photo may get before it is scaled down.
 *
 * The limit is on the card's *size*, never on its shape: hitting it shrinks both sides together, so
 * a tall page photo lands smaller rather than squashed. Clamping the height alone — which is what
 * this used to do — left a box whose ratio was not the photo's, and `object-contain` filled the
 * difference with bars. That is where the black edges in the notebook came from.
 */
const ENTRY_PHOTO_HEIGHT_MAX = 420;
/** Below this a card is a strip nobody can read; a very wide panorama is scaled to fit it instead. */
const ENTRY_PHOTO_HEIGHT_MIN = 180;
const ENTRY_TOP = 90;
const ENTRY_GAP = 40;

/** Breathing room kept under the last line of the page when a card has to go to the bottom. */
const ENTRY_BOTTOM = 60;
/** How finely the free-space scan walks down the page. Small enough to find a gap, cheap enough. */
const SCAN_STEP = 10;

export interface EntrySlot {
  x: number;
  y: number;
  width: number;
  height: number;
  /** A degree or two of tilt: a perfectly square grid reads as a table, not a notebook. */
  rotation: number;
  z: number;
}

/**
 * The card's size for a photo of this shape (`aspect` = width/height), or the fixed text-only shape.
 *
 * A card is never given a ratio that is not the photo's: when the derived height runs past
 * `ENTRY_PHOTO_HEIGHT_MAX`, the width comes down with it. The old version clamped the height on its
 * own, which quietly changed the box's shape and handed `object-contain` a gap to letterbox — every
 * portrait exam photo sat between black bars.
 */
export function entryCardSize(aspect?: number | null): {
  width: number;
  height: number;
} {
  let width = ENTRY_WIDTH;
  let height = ENTRY_HEIGHT;
  if (aspect && aspect > 0) {
    height = ENTRY_WIDTH / aspect;
    if (height > ENTRY_PHOTO_HEIGHT_MAX) {
      height = ENTRY_PHOTO_HEIGHT_MAX;
      width = height * aspect;
    } else if (height < ENTRY_PHOTO_HEIGHT_MIN) {
      height = ENTRY_PHOTO_HEIGHT_MIN;
      width = height * aspect;
    }
    // A panorama scaled up to the minimum height can end up wider than the writing area; the width
    // is the hard limit, so it wins and the card simply ends up shorter than the minimum.
    if (width > ENTRY_WIDTH) {
      width = ENTRY_WIDTH;
      height = ENTRY_WIDTH / aspect;
    }
    width = Math.round(width);
    height = Math.round(height);
  }
  return { width, height };
}

/** The highest `z` on the page, so a new item can go on top of everything already there. */
export function topZ(items: NotebookPageItem[]): number {
  return items.reduce((max, item) => Math.max(max, item.z), 0);
}

function overlaps(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
  gap: number,
): boolean {
  return (
    a.x < b.x + b.width + gap &&
    b.x < a.x + a.width + gap &&
    a.y < b.y + b.height + gap &&
    b.y < a.y + a.height + gap
  );
}

/**
 * Where a freshly added card lands: the first free spot from the top of the writing column, or the
 * bottom of the page when no gap is tall enough.
 *
 * There is no "page full" any more. The student decides what goes on which page: a crowded page
 * still takes the card, at the bottom on top of the others, and they arrange it from there. Saying
 * "this page is full" while the facing page sat empty was the notebook deciding for them.
 *
 * Only entry cards count as taken space. Stickers and notes are decoration the student is about to
 * drag wherever they like, and treating them as walls would push cards down for no reason.
 *
 * The scan looks for real free space rather than stacking under the last card, so a gap the student
 * opened by moving a card away is the first place the next one goes.
 */
export function entrySlot(
  items: NotebookPageItem[],
  aspect?: number | null,
): EntrySlot {
  const entries = items.filter((item) => item.kind === "entry");
  const { width, height } = entryCardSize(aspect);
  // Centred in the writing area rather than pinned left: a card narrower than `ENTRY_WIDTH` hung
  // off the margin rule with a growing gap on its right, which reads as a mistake.
  const x = Math.round(ENTRY_LEFT + (ENTRY_WIDTH - width) / 2);
  const lastY = NOTEBOOK_PAGE_CANVAS.height - ENTRY_BOTTOM - height;

  let y: number | null = null;
  for (let candidate = ENTRY_TOP; candidate <= lastY; candidate += SCAN_STEP) {
    const box = { x, y: candidate, width, height };
    if (!entries.some((entry) => overlaps(box, entry, ENTRY_GAP))) {
      y = candidate;
      break;
    }
  }

  return {
    x,
    // No gap anywhere: the bottom of the page, over whatever is there. Never off the paper.
    y: Math.max(0, Math.round(y ?? lastY)),
    width,
    height,
    // Alternating tilt, so consecutive cards do not lean the same way.
    rotation: entries.length % 2 === 0 ? -0.8 : 0.9,
    z: topZ(items) + 1,
  };
}

/**
 * An item of this size centred on a point of the page, kept on the paper.
 *
 * Used wherever the student chose the spot themselves — dropping from the side panel, or carrying
 * an item across to the facing page. The centre is clamped rather than the whole box, so an item
 * dropped near an edge hangs off it a little instead of jumping away from the pointer.
 */
export function centredAt(
  point: { x: number; y: number },
  size: { width: number; height: number },
  page: { width: number; height: number } = NOTEBOOK_PAGE_CANVAS,
): { x: number; y: number } {
  const cx = Math.min(Math.max(point.x, 0), page.width);
  const cy = Math.min(Math.max(point.y, 0), page.height);
  return {
    x: Math.round(cx - size.width / 2),
    y: Math.round(cy - size.height / 2),
  };
}

/**
 * A new sticker or note lands in the middle of the page, on top.
 *
 * Centre rather than "next free slot": decoration is not content, so it has no queue to join — the
 * user is about to drag it wherever they meant it to go anyway.
 */
function centred(width: number, height: number, items: NotebookPageItem[]) {
  return {
    id: crypto.randomUUID(),
    x: Math.round((NOTEBOOK_PAGE_CANVAS.width - width) / 2),
    y: Math.round((NOTEBOOK_PAGE_CANVAS.height - height) / 2),
    width,
    height,
    rotation: 0,
    opacity: 1,
    z: topZ(items) + 1,
  };
}

export function createStickerItem(
  asset: VisionSticker,
  items: NotebookPageItem[],
): NotebookPageItem {
  return { ...centred(180, 180, items), kind: "sticker", asset };
}

/** Note defaults mirror the board's text item so the shared renderer needs no notebook branch. */
export function createNoteItem(
  text: string,
  items: NotebookPageItem[],
): NotebookPageItem {
  return {
    ...centred(420, 120, items),
    kind: "text",
    text,
    font: "script",
    size: 44,
    color: "#111111",
    bold: false,
    italic: false,
    align: "left",
    lineHeight: 1.2,
    letterSpacing: 0,
    background: null,
  };
}
