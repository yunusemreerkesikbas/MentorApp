import { describe, expect, it } from "vitest";
import type { CoachingAnalysisDto, AnalysisImprovementCycleDto } from "@mentor/types";
import { analysisCycleView } from "./analysis-cycle-view";

const cycle = {
  focus: { subjectRef: "math", subjectName: "Math", source: "PHOTO_SIGNAL", evidenceCount: 3 },
  baseline: { mockExamId: "baseline" }, followUp: { mockExamId: "follow-up" },
  steps: { closed: true },
} as AnalysisImprovementCycleDto;
const proposal = { subjectRef: "history", subjectName: "History", source: "LOWEST_AVERAGE", recentTrend: [{ mockExamId: "new" }] } as CoachingAnalysisDto["nextFocus"];
describe("analysis cycle presentation", () => {
  it("keeps completed focus separate from its new proposal", () => {
    const result = analysisCycleView({ improvementCycle: cycle, nextFocus: proposal } as CoachingAnalysisDto);
    expect(result.focus).toBe(cycle.focus);
    expect(result.proposal).toBe(proposal);
    expect(result.coachMockExamId).toBe("follow-up");
  });
  it("does not replace a deleted baseline with the new proposal's attempt", () => {
    const result = analysisCycleView({ improvementCycle: { ...cycle, baseline: null }, nextFocus: proposal } as CoachingAnalysisDto);
    expect(result.coachMockExamId).toBeUndefined();
    expect(result.proposal).toBe(proposal);
  });
  it("keeps an active loop on its baseline without exposing another proposal", () => {
    const result = analysisCycleView({ improvementCycle: { ...cycle, followUp: null, steps: { ...cycle.steps, closed: false } }, nextFocus: proposal } as CoachingAnalysisDto);
    expect(result.coachMockExamId).toBe("baseline");
    expect(result.proposal).toBeNull();
  });
});
