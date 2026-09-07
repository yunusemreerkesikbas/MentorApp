import { describe, expect, it } from "vitest";
import { toPlanTaskDto } from "./coaching.mappers";
import type { PlanTaskRow } from "../infrastructure/plan-task.repository";

describe("toPlanTaskDto analysis origin", () => {
  it("projects verified analysis provenance", () => {
    const row = {
      id: "00000000-0000-4000-8000-000000000001",
      userId: "00000000-0000-4000-8000-000000000002",
      taskDate: "2026-09-08",
      title: "Sayısal mantık tekrarı",
      subject: "Matematik",
      topic: "Sayısal mantık",
      status: "PENDING",
      startTime: null,
      endTime: null,
      description: null,
      coachNote: null,
      originType: "ANALYSIS",
      originRefId: "00000000-0000-4000-8000-000000000003",
      originMeta: {
        baselineMockExamId: "00000000-0000-4000-8000-000000000004",
        subjectRef: "matematik",
        topicRef: "sayisal-mantik",
        source: "PHOTO_SIGNAL",
        evidenceCount: 5,
      },
      sortOrder: 0,
      createdAt: new Date("2026-09-07T10:00:00Z"),
      updatedAt: new Date("2026-09-07T10:00:00Z"),
    } satisfies PlanTaskRow;

    expect(toPlanTaskDto(row).origin).toEqual({
      type: "ANALYSIS",
      examId: row.originRefId,
      baselineMockExamId: row.originMeta.baselineMockExamId,
      subjectRef: "matematik",
      topicRef: "sayisal-mantik",
      source: "PHOTO_SIGNAL",
      evidenceCount: 5,
    });
  });
});
