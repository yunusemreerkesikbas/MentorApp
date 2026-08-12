import { describe, expect, it } from "vitest";

import { getProfileLevelWindow } from "./profile-level-window";

describe("getProfileLevelWindow", () => {
  it("reserves the previous slot at the first level instead of duplicating level one", () => {
    expect(getProfileLevelWindow(1, 12)).toEqual([null, 1, 2]);
  });

  it("keeps the current level centered between adjacent levels", () => {
    expect(getProfileLevelWindow(6, 12)).toEqual([5, 6, 7]);
  });

  it("reserves the next slot at the maximum level instead of duplicating it", () => {
    expect(getProfileLevelWindow(12, 12)).toEqual([11, 12, null]);
  });
});
