import { http } from "@mentor/api-client";
import type { ExamSummaryDto, Paginated } from "@mentor/types";

/** Resolve ids through the existing paginated editorial catalog, including older exams. */
export async function findExamReference(examId: string): Promise<ExamSummaryDto | null> {
  for (let page = 1; ; page += 1) {
    const result = await http<Paginated<ExamSummaryDto>>(`/v1/content/exams?page=${page}&pageSize=100`);
    const exam = result.items.find((item) => item.id === examId);
    if (exam) return exam;
    if (result.items.length === 0 || page * result.pageSize >= result.total) return null;
  }
}
