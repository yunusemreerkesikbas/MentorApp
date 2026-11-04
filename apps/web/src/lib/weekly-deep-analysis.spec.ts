import { describe, expect, it } from "vitest";
import type { WeeklyDeepAnalysisDto } from "@mentor/types";
import { parseNet, pickWeeklyVerdict } from "./weekly-deep-analysis";

type Subject = WeeklyDeepAnalysisDto["subjects"][number];
const subject = (name: string, trend: Subject["trend"], delta: string | null): Subject => ({
  subjectRef: name, subjectName: name, averageNet: "10.00", previousAverageNet: "8.00", delta,
  mockExamCount: 1, previousMockExamCount: 1, focusMinutes: 0, completedTaskCount: 0, trend, message: "",
});

describe("pickWeeklyVerdict", () => {
  it("names the first risen metric and the biggest subject rise", () => {
    const verdict = pickWeeklyVerdict({
      metrics: [
        { id: "FOCUS_MINUTES", current: 265, previous: 180, delta: 85, message: "" },
        { id: "ACTIVE_DAYS", current: 5, previous: 3, delta: 2, message: "" },
        { id: "PLAN_TASKS", current: 4, previous: 6, delta: -2, message: "" },
      ],
      subjects: [subject("Türkçe", "DOWN", "-2.00"), subject("Tarih", "UP", "+1.50"), subject("Matematik", "UP", "+2.00")],
      evidenceMessage: "",
    });
    expect(verdict).toEqual({ metric: { id: "ACTIVE_DAYS", previous: 3, current: 5 }, subject: { name: "Matematik", delta: 2 } });
  });

  it("ignores gains without a recorded previous week", () => {
    expect(pickWeeklyVerdict({
      metrics: [{ id: "ACTIVE_DAYS", current: 5, previous: null, delta: null, message: "" }],
      subjects: [subject("Tarih", "NO_EXAM", null), subject("Matematik", "STEADY", "0.00")],
      evidenceMessage: "",
    })).toEqual({ metric: null, subject: null });
  });

  it("parses API nets", () => {
    expect(parseNet("+2.00")).toBe(2);
    expect(parseNet(null)).toBeNull();
    expect(parseNet("x")).toBeNull();
  });
});
