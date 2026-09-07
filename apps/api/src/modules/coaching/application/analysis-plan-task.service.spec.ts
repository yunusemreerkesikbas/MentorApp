import { describe, expect, it, vi } from "vitest";
import { DomainError } from "../../../common/errors/domain-error";
import { AnalysisPlanTaskService } from "./analysis-plan-task.service";

const input = {
  examId: "00000000-0000-4000-8000-000000000001",
  baselineMockExamId: "00000000-0000-4000-8000-000000000002",
  expectedSubjectRef: "matematik",
  expectedTopicRef: "sayisal-mantik",
  title: "Sayısal mantık tekrarı",
};

function makeService(overrides?: { baselineId?: string; subjectRef?: string }) {
  const plan = { createFromAnalysis: vi.fn(async () => ({ id: "task-1" })) };
  const analysis = {
    getAnalysis: vi.fn(async () => ({
      nextFocus: {
        subjectRef: overrides?.subjectRef ?? "matematik",
        subjectName: "Matematik",
        topicRef: "sayisal-mantik",
        topicName: "Sayısal mantık",
        source: "PHOTO_SIGNAL",
        evidenceCount: 5,
        recentTrend: [
          { mockExamId: overrides?.baselineId ?? input.baselineMockExamId },
        ],
      },
    })),
  };
  const mockExams = {
    getOwnedMockExam: vi.fn(async () => ({ examId: input.examId })),
  };
  const content = {
    listExamSubjects: vi.fn(async () => [
      { slug: "matematik", name: "Matematik" },
    ]),
    listExamTopics: vi.fn(async () => [
      {
        slug: "sayisal-mantik",
        name: "Sayısal mantık",
        subjectSlug: "matematik",
      },
    ]),
  };
  return {
    service: new AnalysisPlanTaskService(
      analysis as never,
      mockExams as never,
      plan as never,
      content as never,
    ),
    plan,
    mockExams,
  };
}

describe("AnalysisPlanTaskService", () => {
  it("stops before reading analysis when ownership verification fails", async () => {
    const { service, mockExams, plan } = makeService();
    mockExams.getOwnedMockExam.mockRejectedValueOnce(new Error("not owned"));
    await expect(service.create("other-user", input)).rejects.toThrow("not owned");
    expect(mockExams.getOwnedMockExam).toHaveBeenCalledWith("other-user", input.baselineMockExamId);
    expect(plan.createFromAnalysis).not.toHaveBeenCalled();
  });

  it("rejects a baseline belonging to another exam", async () => {
    const { service, mockExams, plan } = makeService();
    mockExams.getOwnedMockExam.mockResolvedValueOnce({ examId: "different-exam" });
    await expect(service.create("user-1", input)).rejects.toMatchObject({ code: "ANALYSIS_FOCUS_CHANGED", httpStatus: 409 });
    expect(plan.createFromAnalysis).not.toHaveBeenCalled();
  });

  it.each([{ expectedSubjectRef: "turkce" }, { expectedTopicRef: "different-topic" }])("rejects modified focus %j", async (change) => {
    const { service, plan } = makeService();
    await expect(service.create("user-1", { ...input, ...change })).rejects.toMatchObject({ code: "ANALYSIS_FOCUS_CHANGED", httpStatus: 409 });
    expect(plan.createFromAnalysis).not.toHaveBeenCalled();
  });
  it("fills labels from verified taxonomy before creating the task", async () => {
    const { service, plan } = makeService();
    await service.create("user-1", input);
    expect(plan.createFromAnalysis).toHaveBeenCalledWith(
      "user-1",
      input,
      expect.objectContaining({
        subjectName: "Matematik",
        topicName: "Sayısal mantık",
        source: "PHOTO_SIGNAL",
        evidenceCount: 5,
      }),
    );
  });

  it("returns ANALYSIS_FOCUS_CHANGED when the baseline or focus is stale", async () => {
    const { service } = makeService({ baselineId: "another-baseline" });
    await expect(service.create("user-1", input)).rejects.toMatchObject<Partial<DomainError>>({
      code: "ANALYSIS_FOCUS_CHANGED",
      httpStatus: 409,
    });
  });
});
