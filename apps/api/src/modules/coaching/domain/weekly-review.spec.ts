import { describe, expect, it } from "vitest";
import { energySignal, isWeeklyReviewReady, selectWeeklyFocus, weeklyReviewWindows } from "./weekly-review";

describe("weekly review rules", () => {
  it("uses the previous completed Istanbul Monday-Sunday window", () => {
    expect(weeklyReviewWindows(new Date("2026-07-11T12:00:00Z"))).toEqual({
      current: { start: new Date("2026-06-28T21:00:00.000Z"), end: new Date("2026-07-05T21:00:00.000Z") },
      previous: { start: new Date("2026-06-21T21:00:00.000Z"), end: new Date("2026-06-28T21:00:00.000Z") },
      startDate: "2026-06-29",
      endDate: "2026-07-05",
    });
  });

  it("requires one mock exam or two completed sessions", () => {
    expect(isWeeklyReviewReady(1, 0)).toBe(true);
    expect(isWeeklyReviewReady(0, 2)).toBe(true);
    expect(isWeeklyReviewReady(0, 1)).toBe(false);
  });

  it("maps aggregate mood averages", () => {
    expect(energySignal([])).toBeNull();
    expect(energySignal([2, 3])).toBe("LOW");
    expect(energySignal([3, 3])).toBe("MIXED");
    expect(energySignal([4, 3])).toBe("STEADY");
  });

  it("prioritizes repeated photos, normalized decline, lowest score, then session rhythm", () => {
    const subjects = [
      { subjectRef: "short", subjectName: "Short", questionCount: 6, currentAverageNet: 4, previousAverageNet: 5 },
      { subjectRef: "long", subjectName: "Long", questionCount: 30, currentAverageNet: 12, previousAverageNet: 18 },
    ];
    expect(selectWeeklyFocus(subjects, [{ subjectRef: "short", count: 2 }], true)).toMatchObject({ source: "REPEATED_PHOTO_SIGNAL", subjectRef: "short" });
    expect(selectWeeklyFocus(subjects, [], true)).toMatchObject({ source: "WEEKLY_DECLINE", subjectRef: "long" });
    expect(selectWeeklyFocus(subjects.map((subject) => ({ ...subject, previousAverageNet: null })), [], true)).toMatchObject({ source: "LOWEST_NORMALIZED", subjectRef: "long" });
    expect(selectWeeklyFocus([], [], false)).toEqual({ source: "SESSION_RHYTHM", subjectRef: null, subjectName: null });
  });
});

