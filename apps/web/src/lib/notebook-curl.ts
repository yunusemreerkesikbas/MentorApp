/**
 * The geometry of a page being turned by its corner.
 *
 * A leaf is hinged on a vertical line (the coil) and its free bottom corner is dragged to a point.
 * Folding a flat sheet so that corner lands there creates one straight fold: the perpendicular
 * bisector of the corner and the point. Everything on the corner's side of that line is folded
 * over, mirrored across it, showing the sheet's back; the rest stays where it was. The page
 * underneath shows through where the fold lifted away.
 *
 * That is the whole effect, and it is 2D on purpose: a clip polygon for each half and one
 * reflection. The previous leaf was a rigid 3D card that could only carry blank paper (bending it
 * in 3D was tried and abandoned, see `notebook-page-turn.tsx`). A fold costs nothing to compute,
 * keeps the real page content on both faces, and is what the eye actually reads as paper.
 *
 * Coordinates are the caller's design space (the spread's canvas units), y pointing down.
 */

export interface CurlPoint {
  x: number;
  y: number;
}

export type CurlSide = "right" | "left";

export interface CurlGeometry {
  /** The vertical line the leaf turns around. */
  hingeX: number;
  /** The leaf's own box: its left edge, width and height (its top is y = 0). */
  leafX: number;
  leafWidth: number;
  height: number;
  /** Which side of the hinge the leaf lies on before it is turned. */
  side: CurlSide;
}

export interface CurlModel {
  corner: CurlPoint;
  point: CurlPoint;
  /** Unit normal of the fold, pointing into the folded part (towards the corner). */
  normal: CurlPoint;
  /** Midpoint of corner and point: a point on the fold line. */
  mid: CurlPoint;
  /** The part of the leaf still lying flat, in leaf-local coordinates. Empty once fully turned. */
  front: CurlPoint[];
  /** The folded part, in leaf-local coordinates, before it is mirrored across the fold. */
  folded: CurlPoint[];
  /** Angle of the fold line in degrees, the angle CSS `rotate()` needs for the reflection. */
  foldAngleDeg: number;
  /** 0 at rest, 1 when the corner has reached the other side. */
  progress: number;
}

/** The free corner the leaf is lifted by: bottom outer corner. */
export function curlCorner(geometry: CurlGeometry): CurlPoint {
  return {
    x:
      geometry.side === "right"
        ? geometry.leafX + geometry.leafWidth
        : geometry.leafX,
    y: geometry.height,
  };
}

/** Where the corner ends up when the leaf has turned all the way: mirrored across the hinge. */
export function curlTarget(geometry: CurlGeometry): CurlPoint {
  const corner = curlCorner(geometry);
  return { x: 2 * geometry.hingeX - corner.x, y: geometry.height };
}

/** Distance from the hinge to the free edge: the leaf cannot be pulled further than that. */
function reach(geometry: CurlGeometry): number {
  return Math.abs(curlCorner(geometry).x - geometry.hingeX);
}

/**
 * Keep the corner where a sheet attached along the hinge could actually put it.
 *
 * Two constraints, the ones any paper-turning model uses: the corner can be no further from the
 * bottom of the hinge than the sheet is wide, and no further from the top of the hinge than its
 * diagonal. Without them the fold line cuts through the hinge and the sheet tears off the coil.
 */
export function clampCurlPoint(
  geometry: CurlGeometry,
  point: CurlPoint,
): CurlPoint {
  const corner = curlCorner(geometry);
  let x =
    geometry.side === "right"
      ? Math.min(point.x, corner.x)
      : Math.max(point.x, corner.x);
  // A little room below the page reads as lifting the corner off the desk; much more is a glitch.
  let y = Math.min(point.y, geometry.height + geometry.height * 0.02);
  const width = reach(geometry);
  const diagonal = Math.hypot(width, geometry.height);

  let dx = x - geometry.hingeX;
  let dy = y - geometry.height;
  let distance = Math.hypot(dx, dy);
  if (distance > width) {
    x = geometry.hingeX + (dx / distance) * width;
    y = geometry.height + (dy / distance) * width;
  }
  dx = x - geometry.hingeX;
  dy = y;
  distance = Math.hypot(dx, dy);
  if (distance > diagonal) {
    x = geometry.hingeX + (dx / distance) * diagonal;
    y = (dy / distance) * diagonal;
  }
  return { x, y };
}

/** Sutherland–Hodgman against one half-plane: the points whose signed distance is ≥ 0. */
function clipRect(
  rect: { x0: number; y0: number; x1: number; y1: number },
  signedDistance: (point: CurlPoint) => number,
): CurlPoint[] {
  const corners: CurlPoint[] = [
    { x: rect.x0, y: rect.y0 },
    { x: rect.x1, y: rect.y0 },
    { x: rect.x1, y: rect.y1 },
    { x: rect.x0, y: rect.y1 },
  ];
  const out: CurlPoint[] = [];
  for (let index = 0; index < corners.length; index += 1) {
    const a = corners[index]!;
    const b = corners[(index + 1) % corners.length]!;
    const da = signedDistance(a);
    const db = signedDistance(b);
    if (da >= 0) out.push(a);
    if (da >= 0 !== db >= 0) {
      const t = da / (da - db);
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  return out;
}

/**
 * The fold for a corner dragged to `point`, or null while the corner is (practically) at rest.
 * Polygons come back in the leaf's own coordinates, ready for a `clip-path` on the leaf's box.
 */
export function curlModel(
  geometry: CurlGeometry,
  rawPoint: CurlPoint,
): CurlModel | null {
  const corner = curlCorner(geometry);
  const point = clampCurlPoint(geometry, rawPoint);
  const dx = corner.x - point.x;
  const dy = corner.y - point.y;
  const length = Math.hypot(dx, dy);
  if (length < 0.5) return null;

  const normal = { x: dx / length, y: dy / length };
  const mid = { x: (corner.x + point.x) / 2, y: (corner.y + point.y) / 2 };
  const toLocal = (p: CurlPoint) => ({ x: p.x - geometry.leafX, y: p.y });
  const rect = {
    x0: geometry.leafX,
    y0: 0,
    x1: geometry.leafX + geometry.leafWidth,
    y1: geometry.height,
  };
  const signed = (p: CurlPoint) =>
    (p.x - mid.x) * normal.x + (p.y - mid.y) * normal.y;

  return {
    corner,
    point,
    normal,
    mid,
    front: clipRect(rect, (p) => -signed(p)).map(toLocal),
    folded: clipRect(rect, signed).map(toLocal),
    foldAngleDeg: (Math.atan2(normal.x, -normal.y) * 180) / Math.PI,
    progress: Math.min(1, Math.abs(corner.x - point.x) / (2 * reach(geometry))),
  };
}

/** `clip-path: polygon(...)` for a polygon, or an empty clip when the polygon has collapsed. */
export function curlPolygonCss(points: CurlPoint[]): string {
  if (points.length < 3) return "polygon(0px 0px, 0px 0px, 0px 0px)";
  return `polygon(${points.map((p) => `${p.x.toFixed(2)}px ${p.y.toFixed(2)}px`).join(", ")})`;
}

/**
 * The CSS transform that mirrors the leaf's box across the fold, applied with
 * `transform-origin: 0 0` on an element positioned at the leaf's left edge.
 */
export function curlReflectionCss(model: CurlModel, leafX: number): string {
  const mx = model.mid.x - leafX;
  const my = model.mid.y;
  const angle = model.foldAngleDeg.toFixed(3);
  const back = (-model.foldAngleDeg).toFixed(3);
  return `translate(${mx.toFixed(2)}px, ${my.toFixed(2)}px) rotate(${angle}deg) scaleY(-1) rotate(${back}deg) translate(${(-mx).toFixed(2)}px, ${(-my).toFixed(2)}px)`;
}

/** Applies the same reflection to a point, for tests and for anything that needs to aim at it. */
export function reflectAcrossFold(model: CurlModel, p: CurlPoint): CurlPoint {
  const { mid, normal } = model;
  const distance = (p.x - mid.x) * normal.x + (p.y - mid.y) * normal.y;
  return { x: p.x - 2 * distance * normal.x, y: p.y - 2 * distance * normal.y };
}

/**
 * A `linear-gradient` whose stops are measured from the fold line along its normal, inside a box of
 * `width` × `height` positioned at the leaf's left edge. Positive offsets run into the folded part.
 *
 * CSS measures stops along a gradient line through the box's centre, from a start point that
 * depends on the angle. Converting "n px from the fold" into that frame is what lets the shading
 * sit on the fold wherever it is, at any angle.
 */
export function curlGradientCss(
  model: CurlModel,
  leafX: number,
  width: number,
  height: number,
  stops: ReadonlyArray<readonly [offset: number, color: string]>,
): string {
  const { normal } = model;
  const angle = Math.atan2(normal.x, -normal.y);
  const lineLength =
    Math.abs(width * Math.sin(angle)) + Math.abs(height * Math.cos(angle));
  const startX = width / 2 - (normal.x * lineLength) / 2;
  const startY = height / 2 - (normal.y * lineLength) / 2;
  const origin =
    (model.mid.x - leafX - startX) * normal.x + (model.mid.y - startY) * normal.y;
  const list = stops
    .map(([offset, color]) => `${color} ${(origin + offset).toFixed(1)}px`)
    .join(", ");
  return `linear-gradient(${((angle * 180) / Math.PI).toFixed(2)}deg, ${list})`;
}

/** Ease used by the hands-off turn: slow out of the rest, quick through the middle, settles. */
export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * The corner's path for a turn nobody is holding: from wherever it is to the far side, lifting in
 * the middle the way a page rises off the book before it lies down again.
 */
export function curlPathPoint(
  from: CurlPoint,
  to: CurlPoint,
  eased: number,
  lift: number,
): CurlPoint {
  return {
    x: from.x + (to.x - from.x) * eased,
    y: from.y + (to.y - from.y) * eased - lift * Math.sin(Math.PI * eased),
  };
}
