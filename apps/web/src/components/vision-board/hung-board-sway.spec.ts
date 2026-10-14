import { afterEach, describe, expect, it, vi } from "vitest";
import { SWAY_KICK, hoverKick, markBoardHung, takeBoardHung } from "./hung-board-sway";

describe("hoverKick", () => {
  // Positive rotation is clockwise; about a pivot at the top that carries the bottom to the left.
  it("a mouse coming in from the left pushes the board's bottom to the right", () => {
    expect(hoverKick(110, { left: 100, width: 400 })).toBe(-SWAY_KICK.hover);
  });

  it("a mouse coming in from the right pushes it to the left", () => {
    expect(hoverKick(490, { left: 100, width: 400 })).toBe(SWAY_KICK.hover);
  });
});

describe("the just-hung flag", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("is spent by the first reader, so a refresh does not sway the board again", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("window", {
      sessionStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => void store.set(key, value),
        removeItem: (key: string) => void store.delete(key),
      },
    });

    expect(takeBoardHung()).toBe(false);
    markBoardHung();
    expect(takeBoardHung()).toBe(true);
    expect(takeBoardHung()).toBe(false);
  });

  it("without storage the board simply does not sway", () => {
    expect(() => markBoardHung()).not.toThrow();
    expect(takeBoardHung()).toBe(false);
  });
});
