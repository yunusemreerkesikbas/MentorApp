import type { AnalysisCoachContext } from "../../coaching/domain/analysis-coach-context";

export function analysisCoachPrompt(context: AnalysisCoachContext): string {
  // Explicit projection: never serialize an upstream object with potential extra fields.
  const safe = {
    focus: context.focus ? {
      subjectName: context.focus.subjectName,
      topicName: context.focus.topicName,
      source: context.focus.source,
      evidenceCount: context.focus.evidenceCount,
    } : null,
    focusTrend: context.focusTrend ? {
      direction: context.focusTrend.direction,
      recentDelta: context.focusTrend.recentDelta,
    } : null,
    topics: context.topics.map((topic) => ({
      subjectName: topic.subjectName,
      topicName: topic.topicName,
      count: topic.count,
    })),
    cycle: context.cycle ? {
      practiced: context.cycle.practiced,
      measured: context.cycle.measured,
      closed: context.cycle.closed,
    } : null,
    dominantError: context.dominantError ? {
      errorType: context.dominantError.errorType,
      count: context.dominantError.count,
      sharePercent: context.dominantError.sharePercent,
    } : null,
    notebookStats: {
      savedCount: context.notebookStats.savedCount,
      reviewedCount: context.notebookStats.reviewedCount,
      dueCount: context.notebookStats.dueCount,
      healedCount: context.notebookStats.healedCount,
    },
  };
  return [
    "VERIFIED ANALYSIS AGGREGATES:",
    JSON.stringify(safe),
    "Use at most 1-2 relevant facts, a brief neutral interpretation and one next step. Do not infer causation, predict results or rank students.",
    "cycle is the student's current improvement loop (planned, practiced, measured). When one exists, the next step is the stage it is missing.",
    "The improvement loop is created only through the user's Add to my plan action on Analysis. Never claim to create or complete this loop. Do not emit TASK markers for this analysis review.",
  ].join("\n");
}
