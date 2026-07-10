const PLAN_TASK_TITLE_MAX = 200;
const PLAN_TASK_SUBJECT_MAX = 80;

export interface AnalysisPlanPrefill {
  title: string;
  subject: string;
}

/** Parse the one-time Analysis → Plan task prefill from URL search parameters. */
export function parseAnalysisPlanPrefill(params: {
  add: string | null;
  subject: string | null;
  title: string | null;
}): AnalysisPlanPrefill | null {
  if (params.add !== "1") return null;

  const title = params.title?.trim().slice(0, PLAN_TASK_TITLE_MAX) ?? "";
  if (!title) return null;

  return {
    title,
    subject: params.subject?.trim().slice(0, PLAN_TASK_SUBJECT_MAX) ?? "",
  };
}
