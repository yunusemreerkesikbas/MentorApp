import { contentControllerListExams, contentControllerSubjectsBySlug, contentControllerTopicsBySlug } from "@mentor/api-client";
import type { ExamSummaryDto, ExamSubjectDto, ExamTopicDto } from "@mentor/types";

export type AnalysisFocusRefs = { examId: string; subjectRef: string; topicRef?: string };

export async function loadAnalysisPlanFocus(refs: AnalysisFocusRefs) {
  const exams = await contentControllerListExams() as unknown as ExamSummaryDto[];
  const exam = exams.find((item) => item.id === refs.examId);
  if (!exam) throw new Error("ANALYSIS_FOCUS_CHANGED");
  const [subjects, topics] = await Promise.all([
    contentControllerSubjectsBySlug(exam.slug) as unknown as Promise<ExamSubjectDto[]>,
    contentControllerTopicsBySlug(exam.slug) as unknown as Promise<ExamTopicDto[]>,
  ]);
  const subject = subjects.find((item) => item.slug === refs.subjectRef);
  const topic = refs.topicRef ? topics.find((item) => item.subjectSlug === refs.subjectRef && item.slug === refs.topicRef) : undefined;
  if (!subject || (refs.topicRef && !topic)) throw new Error("ANALYSIS_FOCUS_CHANGED");
  return { subjectName: subject.name, ...(topic && { topicName: topic.name }) };
}

export function validAnalysisTaskDate(value: string | undefined, today: string): boolean {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value < today) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
