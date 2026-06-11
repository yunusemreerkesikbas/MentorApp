import { describe, expect, it } from "vitest";
import { mapMood, MoodLevel } from "./mood";

describe("mapMood", () => {
  it("maps each 1..5 value to its rule-based bucket + stable code + i18n key", () => {
    expect(mapMood(1)).toEqual({
      level: MoodLevel.VERY_LOW,
      code: "COACHING_MOOD_VERY_LOW",
      i18nKey: "coaching.mood.VERY_LOW",
    });
    expect(mapMood(3).level).toBe(MoodLevel.OKAY);
    expect(mapMood(5)).toEqual({
      level: MoodLevel.GREAT,
      code: "COACHING_MOOD_GREAT",
      i18nKey: "coaching.mood.GREAT",
    });
  });

  it("falls back to OKAY for out-of-range values (defensive; boundary already validates 1..5)", () => {
    expect(mapMood(0).level).toBe(MoodLevel.OKAY);
    expect(mapMood(99).level).toBe(MoodLevel.OKAY);
  });
});
