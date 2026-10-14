import { describe, expect, it } from "vitest";
import type { VisionBoardDoc } from "@mentor/types";
import { EMPTY_BOARD } from "./board-document";
import { renderBoardWithinBytes, type BoardRenderOptions } from "./board-export";

/**
 * A stand-in for the canvas, which this environment does not have: it answers with a picture of a
 * set weight per scale and remembers what it was asked for.
 */
function rendererOf(bytesAtScale: Record<number, number>) {
  const calls: BoardRenderOptions[] = [];
  const render = async (_doc: VisionBoardDoc, options: BoardRenderOptions = {}) => {
    calls.push(options);
    const bytes = bytesAtScale[options.scale ?? 2] ?? 0;
    return new Blob([new Uint8Array(bytes)], { type: "image/jpeg" });
  };
  return { render, calls };
}

/**
 * A community post caps a picture's weight. A board heavy with photos must still go up, smaller,
 * rather than be refused by the upload.
 */
describe("renderBoardWithinBytes", () => {
  it("keeps the full-size JPEG when it fits the limit exactly", async () => {
    const { render, calls } = rendererOf({ 2: 1000 });

    const picture = await renderBoardWithinBytes(EMPTY_BOARD, 1000, render);

    expect(picture.size).toBe(1000);
    expect(calls).toEqual([{ type: "image/jpeg" }]);
  });

  it("draws the picture again at half the pixels when the full one is a byte too heavy", async () => {
    const { render, calls } = rendererOf({ 2: 1001, 1: 300 });

    const picture = await renderBoardWithinBytes(EMPTY_BOARD, 1000, render);

    expect(picture.size).toBe(300);
    expect(calls).toEqual([{ type: "image/jpeg" }, { type: "image/jpeg", scale: 1 }]);
  });
});
