import { describe, expect, it } from "vitest";
import { parseAnalysisPlanPrefill } from "./analysis-plan-prefill";

describe("parseAnalysisPlanPrefill", () => {
  it("keeps the verified refs needed by the analysis task endpoint", () => {
    expect(
      parseAnalysisPlanPrefill({
        add: "1",
        source: "analysis",
        title: "Sayısal mantık tekrarı",
        subject: "Matematik",
        topic: "Sayısal mantık",
        examId: "00000000-0000-4000-8000-000000000001",
        baselineMockExamId: "00000000-0000-4000-8000-000000000002",
        subjectRef: "matematik",
        topicRef: "sayisal-mantik",
      }),
    ).toMatchObject({
      source: "analysis",
      examId: "00000000-0000-4000-8000-000000000001",
      baselineMockExamId: "00000000-0000-4000-8000-000000000002",
      subjectRef: "matematik",
      topicRef: "sayisal-mantik",
    });
  });

  it("rejects an incomplete analysis handoff", () => {
    expect(
      parseAnalysisPlanPrefill({
        add: "1",
        source: "analysis",
        title: "Tekrar",
        subject: "Matematik",
        topic: null,
        examId: null,
        baselineMockExamId: null,
        subjectRef: "matematik",
        topicRef: null,
      }),
    ).toBeNull();
  });
});
