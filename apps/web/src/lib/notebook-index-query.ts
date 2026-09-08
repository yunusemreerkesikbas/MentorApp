import type { NotebookErrorType } from "@mentor/types";
import { NOTEBOOK_ENTRY_STATUSES, NOTEBOOK_ERROR_TYPES } from "@mentor/types";

export type NotebookIndexFilters = {
  examId?: string;
  mockExamId?: string;
  subjectRef?: string;
  topicRef?: string;
  errorType?: NotebookErrorType;
  status?: (typeof NOTEBOOK_ENTRY_STATUSES)[number];
};

const NOTEBOOK_INDEX_FILTER_KEYS = [
  "examId",
  "mockExamId",
  "subjectRef",
  "topicRef",
  "errorType",
  "status",
] as const;

/** Stable identity for a result set, used to reject pagination from a previous filter selection. */
export function notebookIndexFilterKey(filters: NotebookIndexFilters): string {
  return NOTEBOOK_INDEX_FILTER_KEYS.map((key) => `${key}:${filters[key] ?? ""}`).join("|");
}

export function parseNotebookIndexQuery(params: URLSearchParams): {
  open: boolean;
  filters: NotebookIndexFilters;
} {
  const get = (key: string, max: number) => params.get(key)?.trim().slice(0, max) || undefined;
  const errorType = get("errorType", 40);
  const status = get("status", 20);
  const uuid = (key: string) => {
    const value = params.get(key)?.trim();
    return value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) ? value : undefined;
  };
  return {
    open: params.get("panel") === "index",
    filters: {
      ...(uuid("examId") && { examId: uuid("examId") }),
      ...(uuid("mockExamId") && { mockExamId: uuid("mockExamId") }),
      ...(get("subjectRef", 120) && { subjectRef: get("subjectRef", 120) }),
      ...(get("topicRef", 120) && { topicRef: get("topicRef", 120) }),
      ...(errorType && NOTEBOOK_ERROR_TYPES.includes(errorType as NotebookErrorType)
        ? { errorType: errorType as NotebookErrorType }
        : {}),
      ...(status && NOTEBOOK_ENTRY_STATUSES.includes(status as (typeof NOTEBOOK_ENTRY_STATUSES)[number])
        ? { status: status as (typeof NOTEBOOK_ENTRY_STATUSES)[number] }
        : {}),
    },
  };
}

export function replaceNotebookIndexQuery(filters: NotebookIndexFilters): void {
  const params = new URLSearchParams(window.location.search);
  params.set("panel", "index");
  for (const key of NOTEBOOK_INDEX_FILTER_KEYS) {
    const value = filters[key];
    if (value) params.set(key, value);
    else params.delete(key);
  }
  window.history.replaceState(window.history.state, "", `${window.location.pathname}?${params}`);
}
