import {
  VISION_BOARD_CANVAS,
  type VisionBoardDoc,
  type VisionBoardItem,
} from "@mentor/types";
import { createTextItem } from "@/components/vision-board/board-document";

/**
 * Starting layouts. An empty canvas is the hardest thing to face, and "where do I put the first
 * photo" is exactly the friction that stops someone finishing a board.
 *
 * Templates place TEXT and empty photo slots only — never somebody else's imagery. Applying one
 * keeps the goal text the user already has; it rearranges, it does not erase.
 */

export type BoardTemplateId = "collage" | "minimal" | "columns";

export const BOARD_TEMPLATE_IDS: BoardTemplateId[] = ["collage", "minimal", "columns"];

const { width: W, height: H } = VISION_BOARD_CANVAS;

/** Photo slots a template suggests; the rail's uploader fills them in order. */
export interface TemplateSlot {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

const SLOTS: Record<BoardTemplateId, TemplateSlot[]> = {
  collage: [
    { x: 90, y: 120, width: 320, height: 420, rotation: -4 },
    { x: 430, y: 70, width: 300, height: 300, rotation: 3 },
    { x: 1180, y: 110, width: 340, height: 430, rotation: 5 },
    { x: 150, y: 610, width: 300, height: 300, rotation: 2 },
    { x: 1130, y: 620, width: 320, height: 310, rotation: -3 },
  ],
  minimal: [
    { x: 140, y: 250, width: 380, height: 500, rotation: -2 },
    { x: 1100, y: 250, width: 380, height: 500, rotation: 2 },
  ],
  columns: [
    { x: 100, y: 150, width: 400, height: 360, rotation: 0 },
    { x: 100, y: 560, width: 400, height: 360, rotation: 0 },
    { x: 1120, y: 150, width: 400, height: 360, rotation: 0 },
    { x: 1120, y: 560, width: 400, height: 360, rotation: 0 },
  ],
};

export function templateSlots(id: BoardTemplateId): TemplateSlot[] {
  return SLOTS[id];
}

/**
 * Apply a template to the current document.
 *
 * Existing images are re-flowed into the template's slots rather than dropped — losing photos
 * somebody already uploaded because they tried a layout would be the worst possible surprise.
 * Anything beyond the slot count keeps its current position.
 */
export function applyTemplate(doc: VisionBoardDoc, id: BoardTemplateId): VisionBoardDoc {
  const slots = SLOTS[id];
  let slotIndex = 0;

  const items: VisionBoardItem[] = doc.items.map((item) => {
    if (item.kind !== "image") return item;
    const slot = slots[slotIndex];
    slotIndex += 1;
    return slot ? { ...item, ...slot } : item;
  });

  // The goal line goes where the template wants a headline; user-written text is left alone.
  const headline: Record<BoardTemplateId, { y: number; size: number }> = {
    collage: { y: H / 2 - 60, size: 76 },
    minimal: { y: 120, size: 88 },
    columns: { y: H / 2 - 60, size: 68 },
  };

  return {
    ...doc,
    items: items.map((item) =>
      item.kind === "text" && item.source === "goal"
        ? { ...item, x: (W - item.width) / 2, ...headline[id] }
        : item,
    ),
  };
}

/** Seed text for a board created straight from a template with no goal line yet. */
export function templateHeadline(text: string, items: readonly VisionBoardItem[]) {
  return {
    ...createTextItem(crypto.randomUUID(), text, items),
    x: (W - 520) / 2,
    y: H / 2 - 60,
  };
}
