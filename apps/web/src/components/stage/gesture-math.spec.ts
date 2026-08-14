import { describe, expect, it } from "vitest";
import type { VisionBoardTextItem } from "@mentor/types";
import { createTextItem } from "@/components/vision-board/board-document";
import {
  MIN_ITEM_SIZE,
  angleFromCentre,
  applyMove,
  applyResize,
  normalizeAngle,
  snapAngle,
  toCanvasScale,
  toLocalDelta,
} from "./gesture-math";

function item(overrides: Partial<VisionBoardTextItem> = {}): VisionBoardTextItem {
  return {
    ...createTextItem("00000000-0000-4000-8000-000000000001", "hedef", []),
    x: 200,
    y: 100,
    width: 400,
    height: 200,
    rotation: 0,
    ...overrides,
  };
}

describe("toCanvasScale", () => {
  it("maps screen px to canvas units", () => {
    // A stage rendered 810 CSS px wide is half the 1620-unit board canvas.
    expect(toCanvasScale(810, 1620)).toBe(2);
    // The same helper serves the notebook's narrower page, which is the point of the parameter.
    expect(toCanvasScale(540, 1080)).toBe(2);
  });
});

describe("toLocalDelta", () => {
  it("is a no-op for an unrotated item", () => {
    expect(toLocalDelta(10, 4, 0)).toEqual({ dx: 10, dy: 4 });
  });

  it("maps a screen delta into the item's own axes", () => {
    // At 90°, dragging right on screen pushes "up" along the item's local axes.
    const local = toLocalDelta(10, 0, 90);
    expect(local.dx).toBeCloseTo(0, 6);
    expect(local.dy).toBeCloseTo(-10, 6);
  });

  it("round-trips through the inverse rotation", () => {
    const once = toLocalDelta(13, -7, 33);
    const back = toLocalDelta(once.dx, once.dy, -33);
    expect(back.dx).toBeCloseTo(13, 6);
    expect(back.dy).toBeCloseTo(-7, 6);
  });
});

describe("applyMove", () => {
  it("offsets the item and keeps integers", () => {
    expect(applyMove(item(), 12.4, -3.6)).toEqual({ x: 212, y: 96 });
  });
});

describe("applyResize", () => {
  it("grows from the south-east corner", () => {
    const next = applyResize(item(), "se", 100, 50, false);
    expect(next.width).toBe(500);
    expect(next.height).toBe(250);
  });

  it("grows from the north-west corner when dragged up and left", () => {
    const next = applyResize(item(), "nw", -100, -50, false);
    expect(next.width).toBe(500);
    expect(next.height).toBe(250);
  });

  /** Opposite corner anchored: the centre shifts by half the growth. */
  it("shifts the centre by half the growth", () => {
    const next = applyResize(item(), "se", 100, 50, false);
    expect(next.x).toBe(250);
    expect(next.y).toBe(125);
  });

  it("never shrinks below the minimum grabbable size", () => {
    const next = applyResize(item(), "se", -10_000, -10_000, false);
    expect(next.width).toBe(MIN_ITEM_SIZE);
    expect(next.height).toBe(MIN_ITEM_SIZE);
  });

  it("keeps the aspect ratio when locked", () => {
    const next = applyResize(item(), "se", 200, 0, true);
    expect(next.width / next.height).toBeCloseTo(400 / 200, 5);
  });

  it("follows the dominant axis when the ratio is locked", () => {
    // Pointer moved mostly vertically → height leads and width is derived from it.
    const next = applyResize(item(), "se", 5, 200, true);
    expect(next.height).toBe(400);
    expect(next.width).toBe(800);
  });

  /** A tilted photo must grow along its own edges, not the screen's. */
  it("resizes a rotated item along its own axes", () => {
    const next = applyResize(item({ rotation: 90 }), "se", 0, 100, false);
    expect(next.width).toBe(500);
    expect(next.height).toBe(200);
  });
});

describe("angleFromCentre", () => {
  it("reports 0° when the pointer is straight above the centre", () => {
    expect(angleFromCentre(100, 100, 100, 40)).toBeCloseTo(0, 6);
  });

  it("reports 90° when the pointer is to the right", () => {
    expect(angleFromCentre(100, 100, 160, 100)).toBeCloseTo(90, 6);
  });

  it("stays inside the -180..180 range the schema allows", () => {
    const deg = angleFromCentre(100, 100, 100, 160);
    expect(deg).toBeGreaterThanOrEqual(-180);
    expect(deg).toBeLessThanOrEqual(180);
  });
});

describe("normalizeAngle", () => {
  it("wraps past a full turn", () => {
    expect(normalizeAngle(370)).toBe(10);
    expect(normalizeAngle(-370)).toBe(-10);
  });

  it("prefers +180 over -180 so the value stays in range", () => {
    expect(normalizeAngle(180)).toBe(180);
    expect(normalizeAngle(-180)).toBe(180);
  });
});

describe("snapAngle", () => {
  it("snaps to 15° steps when asked", () => {
    expect(snapAngle(37, true)).toBe(30);
    expect(snapAngle(38, true)).toBe(45);
  });

  it("rounds to whole degrees otherwise", () => {
    expect(snapAngle(37.6, false)).toBe(38);
  });
});
