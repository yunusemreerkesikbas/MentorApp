import type { CoachingAnalysisDto } from "@mentor/types";

/** Presentation selection only: cycle state and focus remain server-computed. */
export function analysisCycleView(analysis: CoachingAnalysisDto) {
  const cycle = analysis.improvementCycle;
  return {
    focus: cycle?.focus ?? analysis.nextFocus,
    coachMockExamId: cycle
      ? cycle.baseline ? (cycle.steps.closed ? cycle.followUp?.mockExamId : undefined) ?? cycle.baseline.mockExamId : undefined
      : analysis.nextFocus?.recentTrend[0]?.mockExamId,
    proposal: !cycle || cycle.steps.closed || !cycle.baseline ? analysis.nextFocus : null,
  };
}
