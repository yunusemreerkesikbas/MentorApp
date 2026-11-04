import { describe, expect, it } from "vitest";
import { buildWeeklyDeepAnalysis } from "./weekly-deep-analysis";

const translate = (key: string, args?: Record<string, unknown>) => `${key}:${JSON.stringify(args ?? {})}`;
const current = { focusMinutes: 180, activeDays: 4, completedTaskCount: 8, mockExamCount: 2 };
const subject = { subjectRef: "matematik", subjectName: "Matematik", currentNets: [10, 14],
  previousNets: [9, 11], focusMinutes: 90, completedTaskCount: 3 };

describe("weekly deep analysis", () => {
  it("compares completed weeks and includes the sample counts behind subject averages", () => {
    const result = buildWeeklyDeepAnalysis({ current,
      previous: { focusMinutes: 240, activeDays: 3, completedTaskCount: 6, mockExamCount: 2 },
      subjects: [subject], translate, locale: "tr" });
    expect(result.metrics).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "FOCUS_MINUTES", current: 180, previous: 240, delta: -60 }),
      expect.objectContaining({ id: "ACTIVE_DAYS", current: 4, previous: 3, delta: 1 }),
      expect.objectContaining({ id: "PLAN_TASKS", current: 8, previous: 6, delta: 2 }),
    ]));
    expect(result.subjects[0]).toMatchObject({ averageNet: "12.00", previousAverageNet: "10.00",
      delta: "+2.00", mockExamCount: 2, previousMockExamCount: 2, trend: "UP" });
    expect(result.evidenceMessage).toContain("DEEP_EVIDENCE_COMPARABLE");
  });

  it("writes nets in messages the locale's way while DTO fields stay fixed-point", () => {
    const row = { ...subject, currentNets: [13.25], previousNets: [15.5] };
    const tr = buildWeeklyDeepAnalysis({ current, previous: null, subjects: [row], translate, locale: "tr" }).subjects[0]!;
    const result = buildWeeklyDeepAnalysis({ current, previous: null, subjects: [{ ...row, currentNets: [12], previousNets: [10] }], translate, locale: "tr" }).subjects[0]!;
    expect(tr).toMatchObject({ averageNet: "13.25", delta: "-2.25" });
    expect(tr.message).toContain('"delta":"-2,25"');
    expect(result.message).toContain('"delta":"+2"');
    expect(buildWeeklyDeepAnalysis({ current, previous: null, subjects: [row], translate, locale: "en" }).subjects[0]!.message)
      .toContain('"delta":"-2.25"');
  });

  it("does not invent baselines for a first week or a first subject attempt", () => {
    const result = buildWeeklyDeepAnalysis({ current, previous: null,
      subjects: [{ ...subject, currentNets: [-1.25], previousNets: [] }], translate, locale: "tr" });
    expect(result.metrics.every((row) => row.previous === null && row.delta === null)).toBe(true);
    expect(result.subjects[0]).toMatchObject({ averageNet: "-1.25", previousAverageNet: null,
      delta: null, trend: "EARLY", previousMockExamCount: 0 });
    expect(result.evidenceMessage).toContain("DEEP_EVIDENCE_EARLY");
  });

  it("keeps study-only subjects, negative declines and genuine zero baselines", () => {
    const result = buildWeeklyDeepAnalysis({ current: { ...current, mockExamCount: 0 },
      previous: { focusMinutes: 0, activeDays: 1, completedTaskCount: 3, mockExamCount: 0 },
      subjects: [{ ...subject, currentNets: [], previousNets: [] },
        { ...subject, subjectRef: "turkce", currentNets: [-2], previousNets: [0] },
        { ...subject, subjectRef: "empty", currentNets: [], previousNets: [], focusMinutes: 0, completedTaskCount: 0 }], translate, locale: "tr" });
    expect(result.metrics[0]).toMatchObject({ previous: 0, delta: 180 });
    expect(result.subjects).toHaveLength(2);
    expect(result.subjects[0]).toMatchObject({ averageNet: null, delta: null, trend: "NO_EXAM" });
    expect(result.subjects[1]).toMatchObject({ averageNet: "-2.00", previousAverageNet: "0.00", delta: "-2.00", trend: "DOWN" });
    expect(result.evidenceMessage).toContain("DEEP_EVIDENCE_NO_EXAMS");
  });
});
