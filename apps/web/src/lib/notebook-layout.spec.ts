import { describe, expect, it } from "vitest";
import type { NotebookPageItem } from "@mentor/types";
import { NOTEBOOK_PAGE_CANVAS } from "@mentor/types";
import {
  centredAt,
  ENTRY_HEIGHT,
  ENTRY_LEFT,
  ENTRY_WIDTH,
  entrySlot,
} from "./notebook-layout";

function entryItem(
  index: number,
  placement: { y?: number; height?: number } = {},
): NotebookPageItem {
  return {
    id: `00000000-0000-4000-8000-00000000000${index}`,
    kind: "entry",
    entryId: `11111111-1111-4111-8111-11111111111${index}`,
    x: ENTRY_LEFT,
    y: placement.y ?? 0,
    width: ENTRY_WIDTH,
    height: placement.height ?? 100,
    rotation: 0,
    opacity: 1,
    z: index,
  };
}

const sticker: NotebookPageItem = {
  id: "22222222-2222-4222-8222-222222222222",
  kind: "sticker",
  asset: "STAR",
  x: 0,
  y: 0,
  width: 80,
  height: 80,
  rotation: 0,
  opacity: 1,
  z: 9,
};

describe("entrySlot", () => {
  it("puts the first card at the top of an empty page", () => {
    const slot = entrySlot([]);
    expect(slot.y).toBeLessThan(ENTRY_HEIGHT);
    expect(slot.z).toBe(1);
  });

  it("starts below where the last card actually ends", () => {
    // Not `count × fixed step`: once cards are sized from their own photos the heights differ, and
    // a fixed step overlaps the tall ones while leaving a hole under the short ones.
    const tall = entryItem(1, { y: 90, height: 420 });
    expect(entrySlot([tall]).y).toBeGreaterThan(tall.y + tall.height);

    const short = entryItem(1, { y: 90, height: 180 });
    expect(entrySlot([short]).y).toBeLessThan(entrySlot([tall]).y);
  });

  it("gives a photo the card its own ratio, never a cropped-to-fit box", () => {
    // The bars in the notebook came from clamping the height alone, which changed the box's shape
    // and left `object-contain` a gap to fill.
    for (const aspect of [0.5, 0.75, 1, 1.6, 3]) {
      const slot = entrySlot([], aspect);
      expect(slot.width / slot.height).toBeCloseTo(aspect, 1);
    }
  });

  it("scales a very tall photo down instead of squashing it", () => {
    const slot = entrySlot([], 0.4);
    expect(slot.height).toBeLessThanOrEqual(420);
    expect(slot.width).toBeLessThan(ENTRY_WIDTH);
    expect(slot.width / slot.height).toBeCloseTo(0.4, 1);
  });

  it("centres a card narrower than the writing area", () => {
    const narrow = entrySlot([], 0.4);
    const full = entrySlot([], 1.6);
    expect(narrow.x).toBeGreaterThan(full.x);
    expect(narrow.x + narrow.width).toBeLessThan(full.x + full.width);
  });

  it("keeps a text-only card on the fixed shape — it has no ratio to follow", () => {
    const slot = entrySlot([]);
    expect(slot.height).toBe(ENTRY_HEIGHT);
    expect(slot.width).toBe(ENTRY_WIDTH);
  });

  it("counts only entry cards — stickers and notes never use up a slot", () => {
    expect(entrySlot([sticker]).y).toBe(entrySlot([]).y);
  });

  it("stacks above whatever is on top, decoration included", () => {
    expect(entrySlot([sticker]).z).toBe(sticker.z + 1);
  });

  it("never refuses a card: a crowded page takes it at the bottom, on the paper", () => {
    // "Bu sayfa doldu" while the facing page sat empty was the notebook deciding for the student.
    const crowded = Array.from({ length: 6 }, (_, i) =>
      entryItem(i, { y: 90 + i * 240, height: 200 }),
    );
    const slot = entrySlot(crowded);
    expect(slot.y + slot.height).toBeLessThanOrEqual(NOTEBOOK_PAGE_CANVAS.height);
    expect(slot.y).toBeGreaterThan(crowded[4]!.y);
  });

  it("fills a gap the student opened instead of stacking under the last card", () => {
    const top = entryItem(1, { y: 90, height: 300 });
    const bottom = entryItem(2, { y: 1100, height: 300 });
    const slot = entrySlot([top, bottom]);
    expect(slot.y).toBeGreaterThan(top.y + top.height);
    expect(slot.y + slot.height).toBeLessThan(bottom.y);
  });
});

describe("centredAt", () => {
  it("centres the item on the point", () => {
    expect(centredAt({ x: 500, y: 600 }, { width: 200, height: 100 })).toEqual({
      x: 400,
      y: 550,
    });
  });

  it("keeps the centre on the paper when the point is off it", () => {
    const placed = centredAt({ x: -300, y: 99999 }, { width: 200, height: 100 });
    expect(placed.x).toBe(-100);
    expect(placed.y).toBe(NOTEBOOK_PAGE_CANVAS.height - 50);
  });
});
