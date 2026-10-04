import { describe, expect, it } from "vitest";
import {
  buildMentorshipWeeklyComparison,
  completedMentorshipWeek,
} from "./mentorship-weekly-report";

describe("completedMentorshipWeek", () => {
  it("uses the last fully completed Istanbul Monday-to-Sunday week", () => {
    expect(
      completedMentorshipWeek(new Date("2026-09-13T20:30:00.000Z")),
    ).toEqual({
      startDate: "2026-08-31",
      endDate: "2026-09-06",
      previousStartDate: "2026-08-24",
      previousEndDate: "2026-08-30",
      timeZone: "Europe/Istanbul",
    });
  });

  it("accepts a completed Monday across a year boundary", () => {
    expect(
      completedMentorshipWeek(
        new Date("2026-01-12T09:00:00.000Z"),
        "2025-12-29",
      ),
    ).toEqual({
      startDate: "2025-12-29",
      endDate: "2026-01-04",
      previousStartDate: "2025-12-22",
      previousEndDate: "2025-12-28",
      timeZone: "Europe/Istanbul",
    });
  });

  it.each(["2026-09-01", "2026-09-07", "2026-09-14"])(
    "rejects non-Monday or unfinished period %s",
    (startDate) => {
      expect(() =>
        completedMentorshipWeek(
          new Date("2026-09-13T09:00:00.000Z"),
          startDate,
        ),
      ).toThrow("MENTORSHIP_WEEK_INVALID");
    },
  );
});

describe("buildMentorshipWeeklyComparison", () => {
  it("keeps no planned work distinct from zero completion", () => {
    const report = buildMentorshipWeeklyComparison(
      {
        focusMinutes: 0,
        sessions: 0,
        activeDays: 0,
        plannedTasks: 0,
        completedTasks: 0,
      },
      {
        focusMinutes: 20,
        sessions: 1,
        activeDays: 1,
        plannedTasks: 3,
        completedTasks: 0,
      },
    );

    expect(report.current.completionRate).toBeNull();
    expect(report.previous.completionRate).toBe(0);
    expect(report.current.hasRecordedActivity).toBe(false);
    expect(report.previous.hasRecordedActivity).toBe(true);
    expect(report.deltas).toEqual({
      focusMinutes: -20,
      sessions: -1,
      activeDays: -1,
      plannedTasks: -3,
      completedTasks: 0,
      completionRate: null,
    });
  });
});
