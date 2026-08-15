import type { VisionBoardItemBase } from "@mentor/types";

/**
 * Geometry for dragging, resizing and rotating a placed item. Pure functions, no DOM — the hook
 * feeds them pointer deltas already converted to canvas units, which keeps the only tricky part
 * (rotation) testable without a browser.
 *
 * Typed on `VisionBoardItemBase` rather than on any one document's item union: the vision board and
 * the mistake notebook place different things, but a rectangle with a rotation behaves the same
 * either way. Their design spaces differ too, which is why the canvas width is a parameter instead
 * of an import — a notebook page is 1080 units wide, a board 1620.
 */

export type GestureMode =
  | { kind: "move" }
  | { kind: "resize"; corner: ResizeCorner }
  | { kind: "rotate" };

export type ResizeCorner = "nw" | "ne" | "se" | "sw";

/** Minimum on-canvas size. Below this an item is a dot nobody can grab again. */
export const MIN_ITEM_SIZE = 32;

/** Screen px → canvas px. The stage is `stageWidthPx` CSS px wide and `canvasWidth` units across. */
export function toCanvasScale(stageWidthPx: number, canvasWidth: number): number {
  return canvasWidth / stageWidthPx;
}

/**
 * A pointer delta measured on screen, mapped into the item's own (rotated) axes.
 *
 * Without this, resizing a tilted photo by its corner drifts sideways: the handle moves along the
 * screen's axes while the box grows along its own.
 */
export function toLocalDelta(
  dx: number,
  dy: number,
  rotationDeg: number,
): { dx: number; dy: number } {
  const rad = (-rotationDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return { dx: dx * cos - dy * sin, dy: dx * sin + dy * cos };
}

export function applyMove(
  item: VisionBoardItemBase,
  dx: number,
  dy: number,
): Pick<VisionBoardItemBase, "x" | "y"> {
  return { x: Math.round(item.x + dx), y: Math.round(item.y + dy) };
}

/**
 * Resize from a corner: the opposite corner stays put, which is what makes a drag feel anchored.
 * `lockRatio` keeps photos from being squashed — the exporter honours whatever ratio is stored,
 * so a stretched box stays stretched in the PNG too.
 */
export function applyResize(
  item: VisionBoardItemBase,
  corner: ResizeCorner,
  dx: number,
  dy: number,
  lockRatio: boolean,
): Pick<VisionBoardItemBase, "x" | "y" | "width" | "height"> {
  const signX = corner === "ne" || corner === "se" ? 1 : -1;
  const signY = corner === "sw" || corner === "se" ? 1 : -1;

  const local = toLocalDelta(dx, dy, item.rotation);
  let width = Math.max(MIN_ITEM_SIZE, item.width + local.dx * signX);
  let height = Math.max(MIN_ITEM_SIZE, item.height + local.dy * signY);

  if (lockRatio) {
    const ratio = item.width / item.height;
    // Follow whichever axis the pointer pushed harder; picking one axis unconditionally makes the
    // other feel dead.
    if (Math.abs(local.dx) > Math.abs(local.dy)) height = Math.max(MIN_ITEM_SIZE, width / ratio);
    else width = Math.max(MIN_ITEM_SIZE, height * ratio);
  }

  /*
   * The box grows about its centre (transform-origin), so holding the opposite corner still means
   * shifting the centre by half the growth — expressed back in screen axes, since x/y are stored
   * unrotated.
   */
  const grewX = (width - item.width) * signX;
  const grewY = (height - item.height) * signY;
  const shift = unrotate(grewX / 2, grewY / 2, item.rotation);

  return {
    x: Math.round(item.x + shift.dx),
    y: Math.round(item.y + shift.dy),
    width: Math.round(width),
    height: Math.round(height),
  };
}

/** Item axes → screen axes (the inverse of {@link toLocalDelta}). */
function unrotate(dx: number, dy: number, rotationDeg: number): { dx: number; dy: number } {
  const rad = (rotationDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return { dx: dx * cos - dy * sin, dy: dx * sin + dy * cos };
}

/** Angle from the item's centre to the pointer, in the same -180..180 range the schema allows. */
export function angleFromCentre(
  centreX: number,
  centreY: number,
  pointerX: number,
  pointerY: number,
): number {
  const deg = (Math.atan2(pointerY - centreY, pointerX - centreX) * 180) / Math.PI;
  return normalizeAngle(deg + 90); // handle sits above the item, so 0° is "upright"
}

export function normalizeAngle(deg: number): number {
  const wrapped = ((deg + 180) % 360 + 360) % 360 - 180;
  // -180 and 180 are the same angle; the schema accepts both, so pick the positive one.
  return wrapped === -180 ? 180 : wrapped;
}

/** Shift-rotate snaps to 15°, the usual "make it straight again" affordance. */
export function snapAngle(deg: number, snap: boolean): number {
  return snap ? normalizeAngle(Math.round(deg / 15) * 15) : Math.round(deg);
}
