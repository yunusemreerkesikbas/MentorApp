import { describe, expect, it } from "vitest";
import {
  clampCurlPoint,
  curlCorner,
  curlFrame,
  curlGradientCss,
  curlModel,
  curlPathPoint,
  curlPolygonCss,
  curlReflectionCss,
  curlTarget,
  reflectAcrossFold,
  type CurlGeometry,
} from "./notebook-curl";

/** The desktop spread: two 1080 × 1527 pages around a 20-unit coil. */
const RIGHT: CurlGeometry = {
  hingeX: 1090,
  leafX: 1100,
  leafWidth: 1080,
  height: 1527,
  side: "right",
};
const LEFT: CurlGeometry = { ...RIGHT, leafX: 0, side: "left" };

function area(points: { x: number; y: number }[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

describe("notebook curl geometry", () => {
  it("lifts the bottom outer corner and lands it mirrored across the coil", () => {
    expect(curlCorner(RIGHT)).toEqual({ x: 2180, y: 1527 });
    expect(curlTarget(RIGHT)).toEqual({ x: 0, y: 1527 });
    expect(curlCorner(LEFT)).toEqual({ x: 0, y: 1527 });
    expect(curlTarget(LEFT)).toEqual({ x: 2180, y: 1527 });
  });

  it("returns no fold while the corner is at rest", () => {
    expect(curlModel(RIGHT, curlCorner(RIGHT))).toBeNull();
  });

  it("folds a small triangle off the corner for a short pull", () => {
    const model = curlModel(RIGHT, { x: 2080, y: 1447 });
    expect(model).not.toBeNull();
    expect(model!.folded).toHaveLength(3);
    const leafArea = RIGHT.leafWidth * RIGHT.height;
    expect(area(model!.folded)).toBeLessThan(leafArea * 0.01);
    expect(area(model!.front) + area(model!.folded)).toBeCloseTo(leafArea, 0);
  });

  it("mirrors the corner exactly onto the dragged point", () => {
    const point = { x: 1700, y: 1300 };
    const model = curlModel(RIGHT, point)!;
    const reflected = reflectAcrossFold(model, model.corner);
    expect(reflected.x).toBeCloseTo(model.point.x, 6);
    expect(reflected.y).toBeCloseTo(model.point.y, 6);
  });

  it("folds the whole leaf over when the corner reaches the far side", () => {
    const model = curlModel(RIGHT, curlTarget(RIGHT))!;
    expect(model.progress).toBeCloseTo(1, 6);
    expect(area(model.folded)).toBeCloseTo(RIGHT.leafWidth * RIGHT.height, 0);
    expect(curlPolygonCss(model.front)).toBe("polygon(0px 0px, 0px 0px, 0px 0px)");
  });

  it("keeps the corner where a sheet held by the coil can reach", () => {
    const clamped = clampCurlPoint(RIGHT, { x: -4000, y: -3000 });
    const width = 2180 - 1090;
    expect(Math.hypot(clamped.x - 1090, clamped.y - 1527)).toBeLessThanOrEqual(width + 1e-6);
    expect(Math.hypot(clamped.x - 1090, clamped.y)).toBeLessThanOrEqual(
      Math.hypot(width, 1527) + 1e-6,
    );
    // Never further out than the corner itself on its own side.
    expect(clampCurlPoint(RIGHT, { x: 2600, y: 1400 }).x).toBeLessThanOrEqual(2180);
    expect(clampCurlPoint(LEFT, { x: -300, y: 1400 }).x).toBeGreaterThanOrEqual(0);
  });

  it("works the same way for the left page turning back", () => {
    const model = curlModel(LEFT, { x: 300, y: 1350 })!;
    const reflected = reflectAcrossFold(model, model.corner);
    expect(reflected.x).toBeCloseTo(model.point.x, 6);
    expect(model.folded.length).toBeGreaterThanOrEqual(3);
    expect(model.progress).toBeGreaterThan(0);
  });

  it("measures gradient stops from the fold line", () => {
    // A vertical fold: the normal points straight right, so the gradient runs at 90deg and its
    // start is the box's left edge — the fold sits at its own x inside the box.
    const model = curlModel(RIGHT, { x: 1980, y: 1527 })!;
    expect(model.normal.x).toBeCloseTo(1, 6);
    const css = curlGradientCss(model, RIGHT.leafX, 1080, 1527, [
      [0, "red"],
      [10, "blue"],
    ]);
    expect(css).toBe(`linear-gradient(90.00deg, red ${(2080 - 1100).toFixed(1)}px, blue ${(2090 - 1100).toFixed(1)}px)`);
  });

  it("writes a reflection that leaves the fold line where it is", () => {
    const model = curlModel(RIGHT, { x: 1980, y: 1527 })!;
    expect(curlReflectionCss(model, RIGHT.leafX)).toBe(
      "translate(980.00px, 1527.00px) rotate(90.000deg) scaleY(-1) rotate(-90.000deg) translate(-980.00px, -1527.00px)",
    );
  });

  it("draws a resting corner as a flat leaf and a turning one with its shading", () => {
    expect(curlFrame(RIGHT, curlCorner(RIGHT), 1)).toBeNull();
    const frame = curlFrame(RIGHT, { x: 1600, y: 1300 }, 0.5)!;
    expect(frame.front.startsWith("polygon(")).toBe(true);
    expect(frame.folded.startsWith("polygon(")).toBe(true);
    expect(frame.reflection).toContain("scaleY(-1)");
    expect(frame.flapShade.startsWith("linear-gradient(")).toBe(true);
    expect(frame.lift).toBeGreaterThan(0);
    expect(frame.lift).toBeLessThanOrEqual(1);
    // Half-size shading: the highlight stop sits 21 units past the crease, not 42.
    const flat = curlFrame(RIGHT, { x: 1980, y: 1527 }, 0.5)!;
    expect(flat.flapShade).toContain(`rgba(255,255,255,0.42) ${(980 + 21).toFixed(1)}px`);
  });

  it("is lying flat again once the leaf is all the way over", () => {
    const frame = curlFrame(RIGHT, curlTarget(RIGHT), 1)!;
    expect(frame.progress).toBeCloseTo(1, 6);
    expect(frame.lift).toBeCloseTo(0, 6);
  });

  it("lifts the corner in the middle of a hands-off turn", () => {
    const from = { x: 2180, y: 1527 };
    const to = { x: 0, y: 1527 };
    expect(curlPathPoint(from, to, 0, 200)).toEqual(from);
    expect(curlPathPoint(from, to, 1, 200).x).toBeCloseTo(0, 6);
    expect(curlPathPoint(from, to, 0.5, 200).y).toBeCloseTo(1327, 6);
  });
});
