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
/** Fallback for a text-only mistake, and the step the next slot's `y` is still measured in — see
 *  `nextEntrySlot`'s own note on why a photo's real height isn't threaded through that math too. */
export const ENTRY_HEIGHT = 300;
/** A placed photo's height is derived from its own ratio at `ENTRY_WIDTH`, clamped to this range so
 *  a very tall or very wide photo still reads as one card rather than a sliver or a banner. */
const ENTRY_PHOTO_HEIGHT_MIN = 180;
const ENTRY_PHOTO_HEIGHT_MAX = 420;
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
 * `aspect` (the uploaded photo's own width/height) sizes the slot to match it — `object-contain`
 * inside a box shaped like the photo has nothing to letterbox, where the old fixed `ENTRY_HEIGHT`
 * forced every photo, portrait or landscape, into the same landscape-ish box and let big black bars
 * show through on anything portrait (most exam pages). `y` still steps by the fixed `ENTRY_HEIGHT`
 * rather than each card's own real height: getting that right needs summing every existing entry's
 * placed height, which is a bigger change than this fix asked for, and the existing "they can
 * rearrange later" placement philosophy already treats a placed slot as a starting point, not a
 * final layout.
 */
export function nextEntrySlot(
  items: NotebookPageItem[],
  aspect?: number | null,
): EntrySlot | null {
  const used = items.filter((item) => item.kind === "entry").length;
  if (used >= ENTRIES_PER_PAGE) return null;

  const highestZ = items.reduce((max, item) => Math.max(max, item.z), 0);
  const height = aspect
    ? Math.round(
        Math.min(ENTRY_PHOTO_HEIGHT_MAX, Math.max(ENTRY_PHOTO_HEIGHT_MIN, ENTRY_WIDTH / aspect)),
      )
    : ENTRY_HEIGHT;
  return {
    x: ENTRY_LEFT,
    y: ENTRY_TOP + used * (ENTRY_HEIGHT + ENTRY_GAP),
    width: ENTRY_WIDTH,
    height,
    // Alternating tilt, so consecutive cards do not lean the same way.
    rotation: used % 2 === 0 ? -0.8 : 0.9,
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
