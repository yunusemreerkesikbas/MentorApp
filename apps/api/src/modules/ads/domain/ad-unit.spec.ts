import { describe, expect, it } from "vitest";
import { isGoogleTestAdUnit, resolveAdUnit } from "./ad-unit";

describe("ad inventory source", () => {
  it("keeps configured paths ahead of the explicit legacy fallback", () => {
    expect(resolveAdUnit("/123/current", "/456/legacy")).toEqual({ path: "/123/current", source: "CONFIG" });
    expect(resolveAdUnit("", "/456/legacy")).toEqual({ path: "/456/legacy", source: "ENV" });
    expect(resolveAdUnit("", undefined)).toEqual({ path: null, source: "NONE" });
  });
  it.each(["/6355419/Travel/Europe/France/Paris", "/6355419/other-sample", "/123,6355419/sample"])("recognizes official sample network %s", (path) => {
    expect(isGoogleTestAdUnit(path)).toBe(true);
  });
  it.each([null, "/123/production", "/63554190/own-unit"])("does not mistake %s for Google's sample network", (path) => {
    expect(isGoogleTestAdUnit(path)).toBe(false);
  });
});
