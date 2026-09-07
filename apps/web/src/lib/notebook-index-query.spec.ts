import { describe, expect, it } from "vitest";
import {
  notebookIndexFilterKey,
  parseNotebookIndexQuery,
} from "./notebook-index-query";

describe("parseNotebookIndexQuery", () => {
  it("restores analysis filters for the index panel", () => {
    const params = new URLSearchParams({
      panel: "index",
      examId: "00000000-0000-4000-8000-000000000001",
      mockExamId: "00000000-0000-4000-8000-000000000002",
      subjectRef: "matematik",
      topicRef: "sayisal-mantik",
      errorType: "UNKNOWN_TOPIC",
    });
    expect(parseNotebookIndexQuery(params)).toMatchObject({
      open: true,
      filters: { subjectRef: "matematik", topicRef: "sayisal-mantik" },
    });
  });

  it("rejects malformed ids while preserving valid selectors", () => {
    const parsed = parseNotebookIndexQuery(
      new URLSearchParams({
        panel: "index",
        examId: "not-an-id",
        mockExamId: "00000000-0000-4000-8000-000000000002",
        status: "ACTIVE",
      }),
    );

    expect(parsed.filters).toEqual({
      mockExamId: "00000000-0000-4000-8000-000000000002",
      status: "ACTIVE",
    });
  });
});

describe("notebookIndexFilterKey", () => {
  it("changes when a hidden analysis filter changes", () => {
    expect(notebookIndexFilterKey({ examId: "exam-a" })).not.toBe(
      notebookIndexFilterKey({ examId: "exam-b" }),
    );
    expect(notebookIndexFilterKey({ mockExamId: "mock-a" })).not.toBe(
      notebookIndexFilterKey({ mockExamId: "mock-b" }),
    );
  });
});
