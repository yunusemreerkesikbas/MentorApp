import { describe, expect, it } from "vitest";
import { activityTone, seriesDates, summarizeActivity } from "./activity-tone";

describe("activityTone", () => {
  it("keeps an empty day off the ramp", () => {
    expect(activityTone(0)).toBe(0);
    expect(activityTone(-5)).toBe(0);
  });

  it("steps at 1, 30 and 90 minutes", () => {
    expect([1, 29, 30, 89, 90, 400].map(activityTone)).toEqual([1, 1, 2, 2, 3, 3]);
  });
});

describe("summarizeActivity", () => {
  it("counts the days with any focus and the minutes in total", () => {
    expect(summarizeActivity([0, 25, 0, 90, 5])).toEqual({ activeDays: 3, totalMinutes: 120 });
  });
});

describe("seriesDates", () => {
  it("dates each entry back from today, oldest first", () => {
    expect(seriesDates(3, "2026-09-01")).toEqual(["2026-08-30", "2026-08-31", "2026-09-01"]);
  });
});
