import { describe, expect, it } from "vitest";

import { parseAchievementPreviewId } from "./achievement-preview";

describe("parseAchievementPreviewId", () => {
  it("accepts a locked V1 achievement id", () => {
    expect(parseAchievementPreviewId("first_step")).toBe("first_step");
    expect(parseAchievementPreviewId("helped_someone")).toBe("helped_someone");
  });

  it("rejects missing and unknown preview values", () => {
    expect(parseAchievementPreviewId(null)).toBeNull();
    expect(parseAchievementPreviewId("not_an_achievement")).toBeNull();
  });
});
