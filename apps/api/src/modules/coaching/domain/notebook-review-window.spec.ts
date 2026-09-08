import { describe, expect, it } from "vitest";
import { notebookReviewWindow } from "./notebook-review-window";
describe("review calendar window", () => {
  it("includes the current Istanbul day across UTC midnight", () => {
    expect(
      notebookReviewWindow(7, new Date("2026-09-08T21:01:00Z")).toISOString(),
    ).toBe("2026-09-02T21:00:00.000Z");
    expect(
      notebookReviewWindow(7, new Date("2026-09-08T20:59:00Z")).toISOString(),
    ).toBe("2026-09-01T21:00:00.000Z");
  });
  it("crosses months for thirty calendar days", () => {
    expect(
      notebookReviewWindow(30, new Date("2026-03-01T12:00:00Z")).toISOString(),
    ).toBe("2026-01-30T21:00:00.000Z");
  });
});
