import type {
  CoachingAnalysisDto,
  ExamSubjectDto,
  ExamSummaryDto,
  ExamTopicDto,
  MockExamDto,
  NotebookEntryDto,
  NotebookReviewSummary,
  NotebookReviewHistoryItem,
  NotebookErrorType,
  Paginated,
  PlanTaskDto,
} from "@mentor/types";
import type {
  CreateAnalysisPlanTaskInput,
  CreateMockExamInput,
  CreateNotebookEntryInput,
  UpdateMockExamInput,
} from "@mentor/validation";
import {
  contentControllerCurrentExamByFamily,
  contentControllerSubjectsBySlug,
  contentControllerTopicsBySlug,
  http,
} from "@mentor/api-client";
import { newRequestId } from "./request-id.js";

export interface ExamTaxonomyBundle {
  exam: ExamSummaryDto;
  subjects: ExamSubjectDto[];
  topics: ExamTopicDto[];
}

export async function fetchExamTaxonomy(
  examType: string,
  examVariant?: string | null,
): Promise<ExamTaxonomyBundle> {
  const exam = await contentControllerCurrentExamByFamily(
    examType,
    examVariant ?? undefined,
  );
  const [subjects, topics] = await Promise.all([
    contentControllerSubjectsBySlug(exam.slug) as unknown as Promise<
      ExamSubjectDto[]
    >,
    contentControllerTopicsBySlug(exam.slug) as unknown as Promise<
      ExamTopicDto[]
    >,
  ]);
  return { exam, subjects, topics };
}

export async function fetchCoachingAnalysis(
  examId: string,
): Promise<CoachingAnalysisDto> {
  const qs = new URLSearchParams({ examId });
  return (await http<CoachingAnalysisDto>(
    `/v1/coaching/analysis?${qs.toString()}`,
  )) as CoachingAnalysisDto;
}

export async function fetchMockExamsList(
  examId: string,
  page: number,
): Promise<Paginated<MockExamDto>> {
  const qs = new URLSearchParams({
    examId,
    page: String(page),
    pageSize: "5",
  });
  return http<Paginated<MockExamDto>>(`/v1/mock-exams?${qs.toString()}`);
}

export async function createMockExam(
  input: CreateMockExamInput,
): Promise<MockExamDto> {
  return (await http<MockExamDto>("/v1/mock-exams", {
    method: "POST",
    body: JSON.stringify(input),
  })) as MockExamDto;
}

export async function deleteMockExam(id: string): Promise<void> {
  await http<void>(`/v1/mock-exams/${id}`, { method: "DELETE" });
}

export function updateMockExam(id: string, input: UpdateMockExamInput): Promise<MockExamDto> {
  return http<MockExamDto>(`/v1/mock-exams/${id}`, { method: "PUT", body: JSON.stringify(input) });
}

export async function createAnalysisFocusPlanTask(
  input: CreateAnalysisPlanTaskInput,
): Promise<PlanTaskDto> {
  return (await http<PlanTaskDto>("/v1/coaching/analysis/plan-task", {
    method: "POST",
    body: JSON.stringify(input),
  })) as PlanTaskDto;
}

export type MistakeScope = { subjectRef?: string; topicRef?: string; mockExamId?: string; errorType?: NotebookErrorType };

export function fetchNotebookEntries(examId: string, scope: MistakeScope, page: number, due = false) {
  const qs = new URLSearchParams({ examId, page: String(page), pageSize: "15" });
  for (const [key, value] of Object.entries(scope)) {
    if (value) qs.set(key, value);
  }
  if (due) {
    qs.set("due", "true");
    qs.set("sort", "review");
  }
  return http<Paginated<NotebookEntryDto>>(`/v1/coaching/notebook/entries?${qs}`);
}

export function fetchNotebookReviewSummary(examId: string, scope: Pick<MistakeScope, "subjectRef" | "topicRef">) {
  const qs = new URLSearchParams({ examId, days: "7" });
  if (scope.subjectRef) qs.set("subjectRef", scope.subjectRef);
  if (scope.topicRef) qs.set("topicRef", scope.topicRef);
  return http<NotebookReviewSummary>(`/v1/coaching/notebook/review-summary?${qs}`);
}

export async function createNotebookEntry(
  input: CreateNotebookEntryInput,
): Promise<NotebookEntryDto> {
  return (await http<NotebookEntryDto>("/v1/coaching/notebook/entries", {
    method: "POST",
    body: JSON.stringify(input),
  })) as NotebookEntryDto;
}

export async function reviewNotebookEntry(
  id: string,
  solved: boolean,
  reviewId = newRequestId(),
): Promise<NotebookEntryDto> {

  return (await http<NotebookEntryDto>(
    `/v1/coaching/notebook/entries/${id}/review`,
    {
      method: "POST",
      body: JSON.stringify({ solved, reviewId }),
    },
  )) as NotebookEntryDto;
}

export function fetchNotebookEntry(id: string) {
  return http<NotebookEntryDto>(`/v1/coaching/notebook/entries/${id}`);
}

export function fetchNotebookReviewHistory(examId: string, page: number) {
  const qs = new URLSearchParams({ examId, days: "30", pageSize: "5", page: String(page) });
  return http<Paginated<NotebookReviewHistoryItem>>(`/v1/coaching/notebook/review-history?${qs}`);
}
