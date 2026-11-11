import type {
  CoachingAnalysisDto,
  ExamSubjectDto,
  ExamSummaryDto,
  ExamTopicDto,
  MockExamDto,
  NotebookEntryDto,
  Paginated,
  PlanTaskDto,
} from "@mentor/types";
import type {
  CreateAnalysisPlanTaskInput,
  CreateMockExamInput,
  CreateNotebookEntryInput,
} from "@mentor/validation";
import {
  contentControllerCurrentExamByFamily,
  contentControllerSubjectsBySlug,
  contentControllerTopicsBySlug,
  http,
} from "@mentor/api-client";

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
  examId?: string,
  pageSize = 10,
): Promise<MockExamDto[]> {
  const qs = new URLSearchParams({
    page: "1",
    pageSize: String(pageSize),
  });
  if (examId) qs.set("examId", examId);
  const res = (await http<Paginated<MockExamDto>>(
    `/v1/mock-exams?${qs.toString()}`,
  )) as Paginated<MockExamDto>;
  return res.items;
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

export async function createAnalysisFocusPlanTask(
  input: CreateAnalysisPlanTaskInput,
): Promise<PlanTaskDto> {
  return (await http<PlanTaskDto>("/v1/coaching/analysis/plan-task", {
    method: "POST",
    body: JSON.stringify(input),
  })) as PlanTaskDto;
}

export async function fetchDueNotebookEntries(): Promise<NotebookEntryDto[]> {
  try {
    return (await http<NotebookEntryDto[]>(
      "/v1/coaching/notebook/reviews/due",
    )) as NotebookEntryDto[];
  } catch {
    return [];
  }
}

export async function fetchNotebookEntries(
  examId?: string,
  pageSize = 15,
): Promise<NotebookEntryDto[]> {
  const qs = new URLSearchParams({
    page: "1",
    pageSize: String(pageSize),
  });
  if (examId) qs.set("examId", examId);
  const res = (await http<Paginated<NotebookEntryDto>>(
    `/v1/coaching/notebook/entries?${qs.toString()}`,
  )) as Paginated<NotebookEntryDto>;
  return res.items;
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
): Promise<NotebookEntryDto> {
  // Generate a valid UUID v4 for idempotent review tracking
  const reviewId =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0;
          const v = c === "x" ? r : (r & 0x3) | 0x8;
          return v.toString(16);
        });
  return (await http<NotebookEntryDto>(
    `/v1/coaching/notebook/entries/${id}/review`,
    {
      method: "POST",
      body: JSON.stringify({ solved, reviewId }),
    },
  )) as NotebookEntryDto;
}
