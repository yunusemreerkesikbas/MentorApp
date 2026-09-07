import { describe, expect, it } from "vitest";
import type { MentorshipSharedDataDto } from "@mentor/types";
import { scopeValue } from "./scope-values";

/** Echoes the key and its args, so a test asserts WHICH sentence was chosen and with what. */
const t = (key: string, args?: Record<string, string | number>) =>
  args ? `${key}(${JSON.stringify(args)})` : key;

const VALUES: MentorshipSharedDataDto = {
  activity: {
    windowDays: 7,
    sessions7d: 4,
    focusMinutes7d: 130,
    activeDays7d: 3,
    currentStreak: 3,
    longestStreak: 11,
    lastActiveDate: "2026-09-05",
  },
  planTasks: { titleWindowDays: 14, titleCount: 6, planCompletionRate7d: 0.4 },
  mood: { windowDays: 14, count: 3, average: 3.7 },
  mockExams: { count: 2, latestAt: "2026-09-04T00:00:00.000Z" },
  examType: "KPSS",
};

const empty: MentorshipSharedDataDto = {
  activity: null,
  planTasks: null,
  mood: null,
  mockExams: null,
  examType: null,
};

describe("scopeValue", () => {
  it("reports the activity window it was given rather than assuming seven", () => {
    expect(scopeValue("ACTIVITY", VALUES, t, "tr")).toBe(
      'scope_value_ACTIVITY({"days":7,"sessions":4,"minutes":130,"activeDays":3,"streak":3})',
    );
  });

  it("points at the mock exams instead of restating the nets", () => {
    const line = scopeValue("MOCK_EXAMS", VALUES, t, "tr")!;
    expect(line).toContain('"count":2');
    // No net, no subject — those live on the student's own analysis screen.
    expect(line).not.toContain("62");
  });

  it("keeps the plan's two windows apart", () => {
    // Titles span 14 days, the rate is a 7-day figure: one sentence each, never one number.
    const line = scopeValue("PLAN_TASK_TITLES", VALUES, t, "tr")!;
    expect(line).toContain('scope_value_PLAN_TASK_TITLES({"count":6,"days":14})');
    expect(line).toContain('scope_value_PLAN_RATE({"percent":40})');
  });

  it("drops the rate clause when nothing was planned last week", () => {
    const line = scopeValue(
      "PLAN_TASK_TITLES",
      { ...VALUES, planTasks: { ...VALUES.planTasks!, planCompletionRate7d: null } },
      t,
      "tr",
    )!;
    expect(line).toContain("scope_value_PLAN_TASK_TITLES");
    // Silence is not a zero: a student who planned nothing did not fail to complete anything.
    expect(line).not.toContain("scope_value_PLAN_RATE");
  });

  it("still reports a rate of zero, which is a fact rather than an absence", () => {
    const line = scopeValue(
      "PLAN_TASK_TITLES",
      { ...VALUES, planTasks: { ...VALUES.planTasks!, planCompletionRate7d: 0 } },
      t,
      "tr",
    )!;
    expect(line).toContain('scope_value_PLAN_RATE({"percent":0})');
  });

  it("passes the mood average through, never recomputing it", () => {
    expect(scopeValue("MOOD_LEVEL", VALUES, t, "en")).toContain('"average":"3.7"');
  });

  it("returns the exam track as-is", () => {
    expect(scopeValue("EXAM_TRACK", VALUES, t, "tr")).toBe("KPSS");
  });

  it("says nothing for AI_BRIEF, because it is a method and not a number", () => {
    expect(scopeValue("AI_BRIEF", VALUES, t, "tr")).toBeNull();
  });

  it("says nothing for an unknown key rather than guessing", () => {
    expect(scopeValue("SOMETHING_NEW", VALUES, t, "tr")).toBeNull();
  });

  it("leaves every line bare for a student with no data yet", () => {
    for (const key of ["ACTIVITY", "MOCK_EXAMS", "PLAN_TASK_TITLES", "MOOD_LEVEL", "EXAM_TRACK"]) {
      expect(scopeValue(key, empty, t, "tr")).toBeNull();
    }
  });
});
