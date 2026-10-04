import { describe, expect, it } from "vitest";
import {
  BOOK_ORIGIN,
  bookTransform,
  flatPoseOnto,
  openBookLanding,
} from "./notebook-opening-geometry";

/** Where a point of the untransformed box ends up under translate + scale about BOOK_ORIGIN. */
function place(
  from: { x: number; y: number; width: number; height: number },
  pose: { x: number; y: number; scale: number },
  point: { x: number; y: number },
) {
  const origin = {
    x: from.x + from.width * BOOK_ORIGIN.x,
    y: from.y + from.height * BOOK_ORIGIN.y,
  };
  return {
    x: origin.x + pose.x + pose.scale * (point.x - origin.x),
    y: origin.y + pose.y + pose.scale * (point.y - origin.y),
  };
}

describe("notebook opening geometry", () => {
  it("keeps one function list for every keyframe", () => {
    const resting = bookTransform({ x: 0, y: 0, scale: 1, rotateX: 34, rotateZ: -3, lift: 0 });
    const flat = bookTransform({ x: 120, y: -40, scale: 2, rotateX: 0, rotateZ: 0, lift: 0 });
    const shape = (value: string) => value.replace(/-?\d+(\.\d+)?/g, "#");
    expect(shape(resting)).toBe(shape(flat));
    expect(resting).toContain("perspective(1300px)");
  });

  it("lays the closed book exactly over the target box", () => {
    const from = { x: 300, y: 420, width: 200, height: 282.78 };
    const onto = { x: 720, y: 96, width: 520, height: 735.2 };
    const pose = flatPoseOnto(from, onto);
    const topLeft = place(from, pose, { x: from.x, y: from.y });
    const bottomRight = place(from, pose, {
      x: from.x + from.width,
      y: from.y + from.height,
    });
    expect(pose.scale).toBeCloseTo(2.6, 6);
    expect(topLeft.x).toBeCloseTo(onto.x, 6);
    expect(topLeft.y).toBeCloseTo(onto.y, 6);
    expect(bottomRight.x).toBeCloseTo(onto.x + onto.width, 6);
    expect(bottomRight.y).toBeCloseTo(onto.y + from.height * pose.scale, 6);
  });

  it("opens a desktop book around the spread's middle and a phone book onto its one page", () => {
    const spread = { x: 100, y: 80, width: 1090, height: 763.5 };
    expect(openBookLanding({ rect: spread, single: false }, 1080 / 2180)).toEqual({
      x: 645,
      y: 80,
      width: 540,
      height: 763.5,
    });
    const leaf = { x: 12, y: 120, width: 366, height: 517.5 };
    expect(openBookLanding({ rect: leaf, single: true }, 1080 / 2180)).toBe(leaf);
  });
});
