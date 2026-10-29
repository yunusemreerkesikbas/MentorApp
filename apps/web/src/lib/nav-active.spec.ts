import { describe, expect, it } from "vitest";
import { isNavActive } from "./nav-active";

describe("isNavActive", () => {
  it("matches the item and its nested pages", () => {
    expect(isNavActive("/plan", "/plan")).toBe(true);
    expect(isNavActive("/students/abc", "/students")).toBe(true);
    expect(isNavActive("/plan", "/dashboard")).toBe(false);
  });

  it("leaves the coach profile to its own tab, not to Öğrencilerim", () => {
    expect(isNavActive("/students/profile", "/students/profile")).toBe(true);
    expect(isNavActive("/students/profile", "/students")).toBe(false);
  });
});
