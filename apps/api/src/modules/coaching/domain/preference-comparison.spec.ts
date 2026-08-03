import { describe, expect, it } from "vitest";

import { comparePreferenceRank } from "./preference-comparison";

describe("comparePreferenceRank", () => {
  it("reports a positive delta when the user rank is ahead of the historical cutoff", () => {
    expect(comparePreferenceRank(42_000, 48_250)).toEqual({
      status: "COMPARED",
      userRank: 42_000,
      cutoffRank: 48_250,
      delta: 6_250,
      direction: "AHEAD",
    });
  });

  it("reports a negative delta when the user rank is behind the historical cutoff", () => {
    expect(comparePreferenceRank(55_000, 48_250)).toEqual({
      status: "COMPARED",
      userRank: 55_000,
      cutoffRank: 48_250,
      delta: -6_750,
      direction: "BEHIND",
    });
  });

  it("reports equality without implying a placement outcome", () => {
    expect(comparePreferenceRank(48_250, 48_250)).toEqual({
      status: "COMPARED",
      userRank: 48_250,
      cutoffRank: 48_250,
      delta: 0,
      direction: "EQUAL",
    });
  });

  it("explains that a comparison is unavailable when the user's rank is missing", () => {
    expect(comparePreferenceRank(null, 48_250)).toEqual({
      status: "NOT_COMPARABLE",
      reason: "MISSING_USER_RANK",
      userRank: null,
      cutoffRank: 48_250,
      delta: null,
      direction: null,
    });
  });

  it("explains that a comparison is unavailable when placement data is missing", () => {
    expect(comparePreferenceRank(42_000, null)).toEqual({
      status: "NOT_COMPARABLE",
      reason: "MISSING_PLACEMENT_RANK",
      userRank: 42_000,
      cutoffRank: null,
      delta: null,
      direction: null,
    });
  });
});
