import { DESK_PERSPECTIVE_PX, type DeskRect } from "./notebook-desk";

/**
 * The arithmetic of the flying notebook: one transform list for every beat of the flight, and the
 * maths that lands its closed box on a rectangle of the editor's.
 *
 * Every keyframe uses the same list of functions in the same order. CSS then interpolates each
 * function on its own (a rotation stays a rotation through 90°) instead of decomposing matrices,
 * which is what keeps the book from tumbling the short way round mid-flight.
 */

/** Where `.nb-book-3d` keeps its transform-origin, as a share of its box. Keep in step with the CSS. */
export const BOOK_ORIGIN = { x: 0.5, y: 0.55 } as const;

/** The book at the top of its lift: risen a little, tilted towards you, squaring up. */
export const LIFT_POSE = {
  /** Rise, as a share of the book's height. */
  rise: 0.08,
  scale: 1.04,
  rotateX: 14,
  /** Height off the desk, as a share of the book's width. */
  lift: 0.3,
} as const;

/** Below this the editor shows one leaf at a time (the editor's own `MOBILE_QUERY`). */
export const PHONE_QUERY = "(max-width: 639px)";

export interface BookPose {
  x: number;
  y: number;
  scale: number;
  rotateX: number;
  rotateZ: number;
  /** translateZ, px. */
  lift: number;
}

export function bookTransform(pose: BookPose): string {
  return [
    `translate(${pose.x.toFixed(2)}px, ${pose.y.toFixed(2)}px)`,
    `scale(${pose.scale.toFixed(4)})`,
    `perspective(${DESK_PERSPECTIVE_PX}px)`,
    `rotateX(${pose.rotateX.toFixed(2)}deg)`,
    `rotateZ(${pose.rotateZ.toFixed(2)}deg)`,
    `translateZ(${pose.lift.toFixed(2)}px)`,
  ].join(" ");
}

/**
 * The translation and scale that lay a book drawn in `from` flat and exactly over `onto`.
 *
 * The transform pivots on `BOOK_ORIGIN`, not on the top-left corner, so scaling also moves the
 * corner; the translation takes that back out.
 */
export function flatPoseOnto(from: DeskRect, onto: DeskRect): BookPose {
  const scale = from.width > 0 ? onto.width / from.width : 1;
  const originX = from.width * BOOK_ORIGIN.x;
  const originY = from.height * BOOK_ORIGIN.y;
  return {
    x: onto.x - from.x - originX * (1 - scale),
    y: onto.y - from.y - originY * (1 - scale),
    scale,
    rotateX: 0,
    rotateZ: 0,
    lift: 0,
  };
}

export function flatTransformOnto(from: DeskRect, onto: DeskRect): string {
  return bookTransform(flatPoseOnto(from, onto));
}

/**
 * The closed book's box that, once its cover has swung open, covers the editor's first spread.
 *
 * The cover opens around the spine, so the closed book's left edge is the spread's middle and its
 * width is one page. `pageShare` is a page's share of the spread's width (the gutter is the rest).
 * On a phone the editor shows the contents page on its own and the book lands right on top of it.
 */
export function openBookLanding(
  landing: { rect: DeskRect; single: boolean },
  pageShare: number,
): DeskRect {
  const { rect, single } = landing;
  if (single) return rect;
  return {
    x: rect.x + rect.width / 2,
    y: rect.y,
    width: rect.width * pageShare,
    height: rect.height,
  };
}
