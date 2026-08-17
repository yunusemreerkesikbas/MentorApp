import { describe, expect, it } from "vitest";

import { menuSelectTextClass } from "./menu-select-typography";

describe("menu select typography", () => {
  it("uses a 14px utility for the small variant", () => {
    expect(menuSelectTextClass("sm")).toBe("text-sm");
  });

  it("keeps the existing base typography by default", () => {
    expect(menuSelectTextClass()).toBe("text-base");
  });
});
