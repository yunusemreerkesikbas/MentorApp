import { describe, expect, it } from "vitest";

import { advanceTopBannerIndex } from "./top-banner-state";

describe("advanceTopBannerIndex", () => {
  it("keeps a single-item banner stable without a rotation target", () => {
    expect(advanceTopBannerIndex(0, 1)).toBe(0);
  });

  it("rotates multiple items and wraps back to the first item", () => {
    expect(advanceTopBannerIndex(0, 3)).toBe(1);
    expect(advanceTopBannerIndex(2, 3)).toBe(0);
  });

  it("normalizes an index after the available item list shrinks", () => {
    expect(advanceTopBannerIndex(4, 2)).toBe(1);
    expect(advanceTopBannerIndex(2, 0)).toBe(0);
  });
});
