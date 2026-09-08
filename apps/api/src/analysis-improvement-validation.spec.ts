import { describe, expect, it } from "vitest";
import {
  createAnalysisPlanTaskSchema,
  listNotebookEntriesQuerySchema,
} from "@mentor/validation";

const baseAnalysisTask = {
  examId: "00000000-0000-4000-8000-000000000001",
  baselineMockExamId: "00000000-0000-4000-8000-000000000002",
  expectedSubjectRef: "matematik",
  expectedTopicRef: "sayisal-mantik",
  title: "Sayısal mantık tekrarını yap",
  taskDate: "2026-09-08",
};

describe("analysis improvement validation", () => {
  it("accepts editable task fields without accepting a client subject", () => {
    expect(createAnalysisPlanTaskSchema.safeParse(baseAnalysisTask).success).toBe(true);
    expect(
      createAnalysisPlanTaskSchema.safeParse({
        ...baseAnalysisTask,
        subject: "Türkçe",
      }).success,
    ).toBe(false);
  });

  it("accepts analysis notebook filters and rejects malformed ids", () => {
    expect(
      listNotebookEntriesQuerySchema.safeParse({
        examId: baseAnalysisTask.examId,
        mockExamId: baseAnalysisTask.baselineMockExamId,
        subjectRef: "matematik",
        topicRef: "sayisal-mantik",
        errorType: "UNKNOWN_TOPIC",
        page: "1",
        pageSize: "20",
      }).success,
    ).toBe(true);
    expect(
      listNotebookEntriesQuerySchema.safeParse({ examId: "not-a-uuid" }).success,
    ).toBe(false);
  });
});
