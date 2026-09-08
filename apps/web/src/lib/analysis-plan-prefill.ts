const PLAN_TASK_TITLE_MAX = 200;
const PLAN_TASK_SUBJECT_MAX = 80;

export interface AnalysisPlanPrefill {
  title: string;
  subject: string;
  topic?: string;
  source?: "analysis";
  examId?: string;
  baselineMockExamId?: string;
  subjectRef?: string;
  topicRef?: string;
}

/** Parse the one-time Analysis → Plan task prefill from URL search parameters. */
export function parseAnalysisPlanPrefill(params: {
  add: string | null;
  source?: string | null;
  subject: string | null;
  topic?: string | null;
  title: string | null;
  examId?: string | null;
  baselineMockExamId?: string | null;
  subjectRef?: string | null;
  topicRef?: string | null;
}): AnalysisPlanPrefill | null {
  if (params.add !== "1") return null;

  const title = params.title?.trim().slice(0, PLAN_TASK_TITLE_MAX) ?? "";
  if (!title) return null;

  const base = {
    title,
    subject: params.subject?.trim().slice(0, PLAN_TASK_SUBJECT_MAX) ?? "",
  };
  if (params.source !== "analysis") return base;

  const examId = params.examId?.trim() ?? "";
  const baselineMockExamId = params.baselineMockExamId?.trim() ?? "";
  const subjectRef = params.subjectRef?.trim().slice(0, 120) ?? "";
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuid.test(examId) || !uuid.test(baselineMockExamId) || !subjectRef) return null;
  const topicRef = params.topicRef?.trim().slice(0, 120) || undefined;
  return {
    ...base,
    source: "analysis",
    examId,
    baselineMockExamId,
    subjectRef,
    ...(topicRef && { topicRef }),
    ...(params.topic?.trim() && { topic: params.topic.trim().slice(0, 160) }),
  };
}
