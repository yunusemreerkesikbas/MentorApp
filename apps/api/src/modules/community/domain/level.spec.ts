import { describe, expect, it } from "vitest";
// ponytail: the curve now lives in @mentor/core (shared with economy); the spec stays here because
// packages/core has no test runner and adding vitest there to relocate one file isn't worth it.
import { deriveLevel, getJourneyLevelByTier } from "@mentor/core";

describe("deriveLevel", () => {
  it("starts at tier 1 with the next threshold ahead", () => {
    expect(deriveLevel(0)).toEqual({
      tier: 1,
      xp: 0,
      nextAt: 100,
      key: "spark",
      chapter: "awakening",
      currentAt: 0,
      nextKey: "trail",
      progress: { current: 0, target: 100, remaining: 100, percent: 0 },
    });
    expect(deriveLevel(99).progress).toEqual({ current: 99, target: 100, remaining: 1, percent: 99 });
  });

  it("advances a tier exactly at the threshold", () => {
    expect(deriveLevel(100)).toMatchObject({
      tier: 2,
      key: "trail",
      chapter: "awakening",
      currentAt: 100,
      nextAt: 300,
      nextKey: "compass",
      progress: { current: 0, target: 200, remaining: 200, percent: 0 },
    });
    expect(deriveLevel(1000)).toMatchObject({
      tier: 5,
      key: "rhythm",
      chapter: "harmony",
      currentAt: 1000,
      nextAt: 1500,
      nextKey: "flow",
    });
  });

  it("calculates progress inside the current tier instead of against total XP", () => {
    expect(deriveLevel(411)).toMatchObject({
      tier: 3,
      key: "compass",
      chapter: "awakening",
      currentAt: 300,
      nextAt: 600,
      nextKey: "cycle",
      progress: { current: 111, target: 300, remaining: 189, percent: 37 },
    });
    expect(deriveLevel(5600)).toMatchObject({
      tier: 10,
      key: "lantern",
      chapter: "shared_light",
      progress: { current: 0, target: 1900, remaining: 1900, percent: 0 },
    });
  });

  it("caps nextAt at null on the top tier", () => {
    expect(deriveLevel(10000)).toEqual({
      tier: 12,
      xp: 10000,
      nextAt: null,
      key: "constellation",
      chapter: "shared_light",
      currentAt: 10000,
      nextKey: null,
      progress: null,
    });
    expect(deriveLevel(99999)).toMatchObject({ tier: 12, xp: 99999, progress: null });
  });

  it("keeps raw negative XP but clamps the derived journey state to its starting point", () => {
    expect(deriveLevel(-25)).toEqual({
      tier: 1,
      xp: -25,
      nextAt: 100,
      key: "spark",
      chapter: "awakening",
      currentAt: 0,
      nextKey: "trail",
      progress: { current: 0, target: 100, remaining: 100, percent: 0 },
    });
  });
});

describe("getJourneyLevelByTier", () => {
  it("returns the canonical identity for a persisted celebration tier", () => {
    expect(getJourneyLevelByTier(5)).toEqual({
      tier: 5,
      key: "rhythm",
      chapter: "harmony",
    });
  });

  it("rejects tiers outside the canonical twelve-level journey", () => {
    expect(() => getJourneyLevelByTier(0)).toThrow("Journey level tier must be between 1 and 12");
    expect(() => getJourneyLevelByTier(13)).toThrow("Journey level tier must be between 1 and 12");
  });
});
