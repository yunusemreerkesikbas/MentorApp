import { describe, expect, it } from "vitest";
import type { NotebookPageItem } from "@mentor/types";
import {
  ENTRIES_PER_PAGE,
  ENTRY_HEIGHT,
  nextEntrySlot,
} from "./notebook-layout";

function entryItem(index: number): NotebookPageItem {
  return {
    id: `00000000-0000-4000-8000-00000000000${index}`,
    kind: "entry",
    entryId: `11111111-1111-4111-8111-11111111111${index}`,
    x: 0,
    y: 0,
    width: 100,
    height: 100,
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

  it("stacks each card below the previous one", () => {
    const first = nextEntrySlot([])!;
    const second = nextEntrySlot([entryItem(1)])!;
    expect(second.y).toBeGreaterThan(first.y + ENTRY_HEIGHT);
  });

  it("counts only entry cards — stickers and notes never use up a slot", () => {
    expect(nextEntrySlot([sticker])!.y).toBe(nextEntrySlot([])!.y);
  });

  it("stacks above whatever is on top, decoration included", () => {
    expect(nextEntrySlot([sticker])!.z).toBe(sticker.z + 1);
  });

  it("returns null on a full page, so the caller offers a new page instead of cramming", () => {
    const full = Array.from({ length: ENTRIES_PER_PAGE }, (_, i) => entryItem(i));
    expect(nextEntrySlot(full)).toBeNull();
  });
});
