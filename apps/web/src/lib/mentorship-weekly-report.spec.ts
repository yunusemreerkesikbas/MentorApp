import { describe, expect, it } from "vitest";
import { formatWeeklyMetric, shiftWeekStart } from "./mentorship-weekly-report";

describe("mentorship weekly report helpers", () => {
  it("moves week starts across year boundaries without local timezone drift", () => {
    expect(shiftWeekStart("2025-12-29", 1)).toBe("2026-01-05");
    expect(shiftWeekStart("2026-01-05", -1)).toBe("2025-12-29");
  });

  it("formats missing rates as missing data rather than zero", () => {
    expect(formatWeeklyMetric("COMPLETION_RATE", null, "tr")).toBe("Yok");
    expect(formatWeeklyMetric("COMPLETION_RATE", null, "en")).toBe("None");
    expect(formatWeeklyMetric("COMPLETION_RATE", 0, "tr")).toBe("%0");
    expect(formatWeeklyMetric("FOCUS_MINUTES", 125, "tr")).toBe("125 dk");
  });
});
