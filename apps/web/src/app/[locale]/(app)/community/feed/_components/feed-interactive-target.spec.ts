import { describe, expect, it } from "vitest";

import { isFeedInteractiveTarget } from "./feed-interactive-target";

describe("feed interactive target", () => {
  it("treats an SVG inside a button as interactive", () => {
    const svgTarget = {
      closest: (selector: string) => (selector.includes("button") ? {} : null),
    };

    expect(isFeedInteractiveTarget(svgTarget)).toBe(true);
  });

  it("does not block navigation for plain card content", () => {
    expect(isFeedInteractiveTarget({ closest: () => null })).toBe(false);
  });
});
