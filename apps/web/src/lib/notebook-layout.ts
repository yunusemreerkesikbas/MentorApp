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
 * All numbers are absolute px in the 1080×1440 design space, the same convention the board items
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

/** How many cards fit down one page before it is full. */
export const ENTRIES_PER_PAGE = Math.floor(
  (NOTEBOOK_PAGE_CANVAS.height - ENTRY_TOP) / (ENTRY_HEIGHT + ENTRY_GAP),
);

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
 * The next free slot on a page, or `null` when the page is full — which is the signal to offer a
 * new page rather than to cram another card in.
 *
 * Counts existing entry cards rather than measuring free space: overlapping is only possible once
 * the user starts dragging, and at that point *they* own the layout and we should not second-guess
 * it by hunting for gaps.
 *
 * `aspect` (the photo's own width/height) shapes the slot. A card is never given a ratio that is
 * not the photo's: when the derived height runs past `ENTRY_PHOTO_HEIGHT_MAX`, the width comes down
 * with it. The old version clamped the height on its own, which quietly changed the box's shape and
 * handed `object-contain` a gap to letterbox — every portrait exam photo sat between black bars.
 *
 * `y` walks the real heights of the cards already placed, not a fixed step. With variable heights a
 * fixed step is wrong in both directions at once: it overlaps the tall ones and leaves a hole under
 * the short ones.
 */
export function nextEntrySlot(
  items: NotebookPageItem[],
  aspect?: number | null,
): EntrySlot | null {
  const entries = items.filter((item) => item.kind === "entry");
  if (entries.length >= ENTRIES_PER_PAGE) return null;

  const highestZ = items.reduce((max, item) => Math.max(max, item.z), 0);

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

  // Where the last card actually ends, which is not `count × step` once heights vary.
  const bottom = entries.reduce(
    (lowest, item) => Math.max(lowest, item.y + item.height),
    ENTRY_TOP - ENTRY_GAP,
  );

  return {
    // Centred in the writing area rather than pinned left: a card narrower than `ENTRY_WIDTH` hung
    // off the margin rule with a growing gap on its right, which reads as a mistake.
    x: Math.round(ENTRY_LEFT + (ENTRY_WIDTH - width) / 2),
    y: Math.round(bottom + ENTRY_GAP),
    width,
    height,
    // Alternating tilt, so consecutive cards do not lean the same way.
    rotation: entries.length % 2 === 0 ? -0.8 : 0.9,
    z: highestZ + 1,
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
    z: items.reduce((max, item) => Math.max(max, item.z), 0) + 1,
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
