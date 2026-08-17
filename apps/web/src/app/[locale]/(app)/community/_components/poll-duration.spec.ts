import { describe, expect, it } from "vitest";
import { durationParts, durationToMinutes } from "./poll-duration";

describe("poll duration", () => {
  it("converts the default day to minutes", () => {
    expect(durationToMinutes({ days: 1, hours: 0, minutes: 0 })).toBe(1_440);
  });

  it("keeps a seven-day selection within the API maximum", () => {
    expect(durationToMinutes({ days: 7, hours: 4, minutes: 30 })).toBe(10_080);
  });

  it("decomposes total minutes for controlled selects", () => {
    expect(durationParts(1_565)).toEqual({ days: 1, hours: 2, minutes: 5 });
  });
});
