import { NOTEBOOK_PAGE_CANVAS, type NotebookPageItem } from "@mentor/types";

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
export const ENTRY_HEIGHT = 300;
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
 */
export function nextEntrySlot(items: NotebookPageItem[]): EntrySlot | null {
  const used = items.filter((item) => item.kind === "entry").length;
  if (used >= ENTRIES_PER_PAGE) return null;

  const highestZ = items.reduce((max, item) => Math.max(max, item.z), 0);
  return {
    x: ENTRY_LEFT,
    y: ENTRY_TOP + used * (ENTRY_HEIGHT + ENTRY_GAP),
    width: ENTRY_WIDTH,
    height: ENTRY_HEIGHT,
    // Alternating tilt, so consecutive cards do not lean the same way.
    rotation: used % 2 === 0 ? -0.8 : 0.9,
    z: highestZ + 1,
  };
}
