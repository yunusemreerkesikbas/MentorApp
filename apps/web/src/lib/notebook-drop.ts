import {
  NOTEBOOK_PAGE_CANVAS,
  VISION_STICKERS,
  type NotebookEntryDto,
  type VisionSticker,
} from "@mentor/types";

/**
 * Drag and drop onto a notebook page, from the side panel or from the computer.
 *
 * Native HTML drag and drop rather than the stage's own pointer gestures: what is being dragged here
 * is not on a page yet (a sticker in the panel, a card in the index, a photo in the file manager),
 * and only the browser's drag carries a file in from outside the window. It does not exist on touch
 * screens, which is fine: on a phone the panel already places with a tap.
 *
 * Custom types rather than `text/plain`, so dragging a sticker into a text field elsewhere does not
 * paste an enum name, and a page only lights up for drags it can actually take.
 */
export const STICKER_DRAG_TYPE = "application/x-mentor-notebook-sticker";
export const ENTRY_DRAG_TYPE = "application/x-mentor-notebook-entry";

export type NotebookDrop =
  | { kind: "sticker"; asset: VisionSticker }
  | { kind: "entry"; entry: NotebookEntryDto }
  | { kind: "photo"; file: File };

/** Whether a drag in progress is one a page takes. Only the types are readable before the drop. */
export function acceptsNotebookDrag(
  types: readonly string[],
  { files }: { files: boolean },
): boolean {
  return (
    types.includes(STICKER_DRAG_TYPE) ||
    types.includes(ENTRY_DRAG_TYPE) ||
    (files && types.includes("Files"))
  );
}

/** What was dropped, or null for anything a page does not take. The first image wins. */
export function readNotebookDrop(
  data: DataTransfer,
  { files }: { files: boolean },
): NotebookDrop | null {
  const sticker = data.getData(STICKER_DRAG_TYPE);
  if (sticker && (VISION_STICKERS as readonly string[]).includes(sticker)) {
    return { kind: "sticker", asset: sticker as VisionSticker };
  }
  const entry = data.getData(ENTRY_DRAG_TYPE);
  if (entry) {
    try {
      return { kind: "entry", entry: JSON.parse(entry) as NotebookEntryDto };
    } catch {
      return null;
    }
  }
  if (!files) return null;
  const photo = Array.from(data.files).find((file) =>
    file.type.startsWith("image/"),
  );
  return photo ? { kind: "photo", file: photo } : null;
}

/**
 * A screen point as a point on the page's design canvas.
 *
 * Items are drawn in `cqw` of the page surface (`notebook-page-stage.tsx`), from the stage's top
 * left corner, so the origin is the stage and the scale is the page surface's width. The stage is
 * absolutely positioned over the whole page today, padding and all, so the two widths agree; the
 * page's is the one the drawing actually uses, so that is the one taken.
 */
export function screenToPage(
  point: { x: number; y: number },
  stage: DOMRect,
  pageWidthPx: number,
): { x: number; y: number } {
  const scale = NOTEBOOK_PAGE_CANVAS.width / pageWidthPx;
  return {
    x: (point.x - stage.left) * scale,
    y: (point.y - stage.top) * scale,
  };
}

/** The stage's own size on the design canvas: the area an item can be placed in. */
export function stageOnPage(
  stage: DOMRect,
  pageWidthPx: number,
): { width: number; height: number } {
  const scale = NOTEBOOK_PAGE_CANVAS.width / pageWidthPx;
  return { width: stage.width * scale, height: stage.height * scale };
}
