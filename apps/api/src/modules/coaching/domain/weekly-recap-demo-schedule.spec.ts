import { describe, expect, it } from "vitest";
import {
  buildWeeklyActivitySummary,
  selectWeeklyTitle,
} from "./weekly-review";
import { buildWeeklyRecapDemoSchedule } from "../../../../scripts/weekly-recap-demo.schedule";

describe("weekly recap demo schedule", () => {
  it("creates a completed-week showcase whose dominant title is Nebula Diver", () => {
    const schedule = buildWeeklyRecapDemoSchedule(
      new Date("2026-07-22T10:00:00.000Z"),
    );
    const activity = buildWeeklyActivitySummary(schedule.currentStartDate, {
      mockExamDates: [schedule.currentExamTakenAt],
      qualifyingSessionDates: schedule.currentSessions.map(
        (session) => session.endedAt,
      ),
      completedPlanTaskDates: schedule.currentTasks.map(
        (task) => task.taskDate,
      ),
    });

    expect(schedule.currentSessions).toHaveLength(5);
    expect(
      schedule.currentSessions.reduce(
        (total, session) => total + session.focusMinutes,
        0,
      ),
    ).toBe(265);
    expect(Math.max(...schedule.currentSessions.map((row) => row.focusMinutes))).toBe(
      80,
    );
    expect(activity).toMatchObject({
      activeDays: 5,
      longestActiveRun: 4,
    });
    expect(
      selectWeeklyTitle(
        {
          status: "READY",
          longestActiveRun: activity.longestActiveRun,
          longestSessionMinutes: 80,
          completedPlanTaskCount: schedule.currentTasks.length,
          focusedSubjectCount: 3,
          mockExamCount: 1,
          evidenceChannelCount: 3,
        },
        {
          longestActiveRun: 4,
          longestSessionMinutes: 50,
          completedPlanTaskCount: 3,
          focusedSubjectCount: 3,
          mockExamCount: 1,
          evidenceChannelCount: 2,
        },
      ),
    ).toBe("FOCUS_DIVER");
  });
});
