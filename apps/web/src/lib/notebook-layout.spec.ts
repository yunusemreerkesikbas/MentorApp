import { describe, expect, it } from "vitest";
import type { NotebookPageItem } from "@mentor/types";
import {
  ENTRIES_PER_PAGE,
  ENTRY_HEIGHT,
  ENTRY_WIDTH,
  nextEntrySlot,
} from "./notebook-layout";

function entryItem(
  index: number,
  placement: { y?: number; height?: number } = {},
): NotebookPageItem {
  return {
    id: `00000000-0000-4000-8000-00000000000${index}`,
    kind: "entry",
    entryId: `11111111-1111-4111-8111-11111111111${index}`,
    x: 0,
    y: placement.y ?? 0,
    width: 100,
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

describe("nextEntrySlot", () => {
  it("puts the first card at the top of an empty page", () => {
    const slot = nextEntrySlot([]);
    expect(slot).not.toBeNull();
    expect(slot!.y).toBeLessThan(ENTRY_HEIGHT);
    expect(slot!.z).toBe(1);
  });

  it("starts below where the last card actually ends", () => {
    // Not `count × fixed step`: once cards are sized from their own photos the heights differ, and
    // a fixed step overlaps the tall ones while leaving a hole under the short ones.
    const tall = entryItem(1, { y: 90, height: 420 });
    expect(nextEntrySlot([tall])!.y).toBeGreaterThan(tall.y + tall.height);

    const short = entryItem(1, { y: 90, height: 180 });
    expect(nextEntrySlot([short])!.y).toBeLessThan(nextEntrySlot([tall])!.y);
  });

  it("gives a photo the card its own ratio, never a cropped-to-fit box", () => {
    // The bars in the notebook came from clamping the height alone, which changed the box's shape
    // and left `object-contain` a gap to fill.
    for (const aspect of [0.5, 0.75, 1, 1.6, 3]) {
      const slot = nextEntrySlot([], aspect)!;
      expect(slot.width / slot.height).toBeCloseTo(aspect, 1);
    }
  });

  it("scales a very tall photo down instead of squashing it", () => {
    const slot = nextEntrySlot([], 0.4)!;
    expect(slot.height).toBeLessThanOrEqual(420);
    expect(slot.width).toBeLessThan(ENTRY_WIDTH);
    expect(slot.width / slot.height).toBeCloseTo(0.4, 1);
  });

  it("centres a card narrower than the writing area", () => {
    const narrow = nextEntrySlot([], 0.4)!;
    const full = nextEntrySlot([], 1.6)!;
    expect(narrow.x).toBeGreaterThan(full.x);
    expect(narrow.x + narrow.width).toBeLessThan(full.x + full.width);
  });

  it("keeps a text-only card on the fixed shape — it has no ratio to follow", () => {
    const slot = nextEntrySlot([])!;
    expect(slot.height).toBe(ENTRY_HEIGHT);
    expect(slot.width).toBe(ENTRY_WIDTH);
  });

  it("counts only entry cards — stickers and notes never use up a slot", () => {
    expect(nextEntrySlot([sticker])!.y).toBe(nextEntrySlot([])!.y);
  });

  it("stacks above whatever is on top, decoration included", () => {
    expect(nextEntrySlot([sticker])!.z).toBe(sticker.z + 1);
  });

  it("returns null on a full page, so the caller offers a new page instead of cramming", () => {
    const full = Array.from({ length: ENTRIES_PER_PAGE }, (_, i) =>
      entryItem(i),
    );
    expect(nextEntrySlot(full)).toBeNull();
  });
});
