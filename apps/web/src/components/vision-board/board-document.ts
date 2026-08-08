import {
  VISION_BOARD_CANVAS,
  type VisionBoardDoc,
  type VisionBoardImageItem,
  type VisionBoardItem,
  type VisionBoardStickerItem,
  type VisionBoardTextItem,
  type VisionDto,
} from "@mentor/types";

/**
 * Defaults and factories for the collage document. Pure — no React, no fetching — so the reducer,
 * the stage and the canvas exporter can all agree on what a fresh item looks like without any of
 * them owning the shape.
 */

export const EMPTY_BOARD: VisionBoardDoc = {
  version: 1,
  status: "DRAFT",
  frame: "wood",
  background: { kind: "texture", value: "cork" },
  items: [],
};

/** Placed items start centred-ish and a touch tilted; a perfect grid does not read as a collage. */
const DEFAULT_IMAGE_SIZE = { width: 360, height: 480 };
const DEFAULT_TEXT_SIZE = { width: 520, height: 120 };
const DEFAULT_STICKER_SIZE = { width: 180, height: 180 };

function nextZ(items: readonly VisionBoardItem[]): number {
  return items.reduce((max, item) => Math.max(max, item.z), 0) + 1;
}

/**
 * A small deterministic tilt from the item's own id, so re-rendering never reshuffles the board
 * and two items dropped in a row do not land at the same angle.
 */
function tiltFor(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return ((Math.abs(hash) % 11) - 5) / 1.2; // roughly -4.2°..+4.2°
}

/** Centre of the canvas, offset so successive drops stagger instead of stacking exactly. */
function dropPosition(
  items: readonly VisionBoardItem[],
  size: { width: number; height: number },
) {
  const step = 28 * (items.length % 6);
  return {
    x: (VISION_BOARD_CANVAS.width - size.width) / 2 + step,
    y: (VISION_BOARD_CANVAS.height - size.height) / 2 + step,
  };
}

export function createImageItem(
  id: string,
  storageKey: string,
  items: readonly VisionBoardItem[],
  naturalRatio?: number,
): VisionBoardImageItem {
  // Keep the photo's own proportions at its default size — cropping should be the user's choice,
  // not something the editor does to every upload on the way in.
  const height = naturalRatio
    ? Math.round(DEFAULT_IMAGE_SIZE.width / naturalRatio)
    : DEFAULT_IMAGE_SIZE.height;
  const size = { width: DEFAULT_IMAGE_SIZE.width, height };
  return {
    id,
    kind: "image",
    storageKey,
    frame: "polaroid",
    ...size,
    ...dropPosition(items, size),
    rotation: tiltFor(id),
    opacity: 1,
    z: nextZ(items),
  };
}

export function createTextItem(
  id: string,
  text: string,
  items: readonly VisionBoardItem[],
): VisionBoardTextItem {
  return {
    id,
    kind: "text",
    text,
    font: "heading",
    size: 48,
    color: "#111111",
    bold: true,
    italic: false,
    align: "center",
    lineHeight: 1.2,
    letterSpacing: 0,
    background: null,
    ...DEFAULT_TEXT_SIZE,
    ...dropPosition(items, DEFAULT_TEXT_SIZE),
    rotation: 0,
    opacity: 1,
    z: nextZ(items),
  };
}

export function createStickerItem(
  id: string,
  asset: VisionBoardStickerItem["asset"],
  items: readonly VisionBoardItem[],
): VisionBoardStickerItem {
  return {
    id,
    kind: "sticker",
    asset,
    ...DEFAULT_STICKER_SIZE,
    ...dropPosition(items, DEFAULT_STICKER_SIZE),
    rotation: tiltFor(id),
    opacity: 1,
    z: nextZ(items),
  };
}

/**
 * The line the board opens with: the goal the user already chose on the map, placed centre stage.
 *
 * Marked `source: "goal"` so a later goal change can refresh it — but only while it is still the
 * seeded text. The moment the user edits those words they are theirs, the marker drops, and
 * nothing overwrites them. Deleting or moving it is ordinary editing; this is a starting point,
 * not a fixed header.
 */
export function createSeedItems(
  goalTitle: string,
  subtitle: string | null,
): VisionBoardItem[] {
  const title: VisionBoardTextItem = {
    ...createTextItem("00000000-0000-4000-8000-000000000001", goalTitle, []),
    y: VISION_BOARD_CANVAS.height / 2 - 110,
    size: 72,
    source: "goal",
  };
  if (!subtitle) return [title];
  const where: VisionBoardTextItem = {
    ...createTextItem("00000000-0000-4000-8000-000000000002", subtitle, [title]),
    y: VISION_BOARD_CANVAS.height / 2 + 10,
    size: 36,
    bold: false,
    source: "goal",
  };
  return [title, where];
}

/** Board photo keys, for the upload/orphan bookkeeping the editor mirrors from the server. */
export function imageKeysOf(doc: VisionBoardDoc): string[] {
  return doc.items.flatMap((item) => (item.kind === "image" ? [item.storageKey] : []));
}

export function countByKind(doc: VisionBoardDoc, kind: VisionBoardItem["kind"]): number {
  return doc.items.filter((item) => item.kind === kind).length;
}

/**
 * Board for a user who has a goal but has never opened the editor. Kept out of the reducer so the
 * shell can decide between "seed a fresh board" and "load the saved one" before any state exists.
 */
export function seededBoard(vision: VisionDto, subtitle: string | null): VisionBoardDoc {
  return { ...EMPTY_BOARD, items: createSeedItems(vision.goalTitle, subtitle) };
}
