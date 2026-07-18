import { describe, expect, it } from "vitest";
import { deriveLevel } from "./level";

describe("deriveLevel", () => {
  it("starts at tier 1 with the next threshold ahead", () => {
    expect(deriveLevel(0)).toEqual({ tier: 1, xp: 0, nextAt: 100 });
    expect(deriveLevel(99)).toEqual({ tier: 1, xp: 99, nextAt: 100 });
  });

  it("advances a tier exactly at the threshold", () => {
    expect(deriveLevel(100)).toEqual({ tier: 2, xp: 100, nextAt: 300 });
    expect(deriveLevel(1000)).toEqual({ tier: 5, xp: 1000, nextAt: 1500 });
  });

  it("continues past the old 3000 ceiling into the extended tiers", () => {
    expect(deriveLevel(3000)).toEqual({ tier: 8, xp: 3000, nextAt: 4200 });
    expect(deriveLevel(5600)).toEqual({ tier: 10, xp: 5600, nextAt: 7500 });
  });

  it("caps nextAt at null on the top tier", () => {
    expect(deriveLevel(10000)).toEqual({ tier: 12, xp: 10000, nextAt: null });
    expect(deriveLevel(99999)).toEqual({ tier: 12, xp: 99999, nextAt: null });
  });
});
