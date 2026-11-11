import {
  emptyScores,
  formatShortDate,
  formatTrendDate,
  paperSubjects,
  parseAnalysisTab,
  scoresFromMockExam,
  shouldNavigateAnalysisTab,
  subjectTotal,
  trendForSparkline,
  validateSubjectCounts,
  withScore,
  type AnalysisTab,
  type AnalysisViewTab,
  type SubjectScores,
} from "@mentor/core";

export {
  emptyScores,
  formatShortDate,
  formatTrendDate,
  paperSubjects,
  parseAnalysisTab,
  scoresFromMockExam,
  shouldNavigateAnalysisTab,
  subjectTotal,
  trendForSparkline,
  validateSubjectCounts,
  withScore,
  type AnalysisTab,
  type AnalysisViewTab,
  type SubjectScores,
};

export function buildAnalysisCoachHref(seed: string, contextMockExamId?: string) {
  return {
    pathname: "/coach/chat" as const,
    query: { seed, ...(contextMockExamId && { contextMockExamId }) },
  };
}

export function buildAnalysisTabHref(
  pathname: string,
  search: string,
  tab: AnalysisTab,
): string {
  const params = new URLSearchParams(search);
  params.set("tab", tab);
  params.delete("_rsc");
  return `${pathname}?${params.toString()}`;
}
