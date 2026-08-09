import { describe, expect, it } from "vitest";
import { VISION_TEXT_FONTS } from "@mentor/types";
import { FONT_STACKS } from "./board-item-view";
import { FONT_FAMILIES } from "./board-export";

/**
 * The DOM renderer (`board-item-view.tsx`) and the canvas PNG exporter (`board-export.ts`) each
 * keep their own font map. If one adds a font key the other misses, the on-screen board and the
 * downloaded PNG silently disagree on what a font choice looks like.
 */
describe("vision board font maps", () => {
  it("board-item-view and board-export define exactly the keys in VISION_TEXT_FONTS", () => {
    const expected = [...VISION_TEXT_FONTS].sort();
    expect(Object.keys(FONT_STACKS).sort()).toEqual(expected);
    expect(Object.keys(FONT_FAMILIES).sort()).toEqual(expected);
  });

  it("has 11 distinct font entries", () => {
    expect(VISION_TEXT_FONTS).toHaveLength(11);
  });
});
