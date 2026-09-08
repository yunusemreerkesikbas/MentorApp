import { describe, expect, it, vi } from "vitest";
import { PlanService } from "./plan.service";
import type { PlanTaskRow } from "../infrastructure/plan-task.repository";

describe("analysis plan reuse", () => {
  it.each([undefined, "problemler"])("reuses a pending exact focus without emitting another creation (%s)", async (topicRef) => {
    const row = { id: "task", userId: "user", taskDate: new Date().toISOString().slice(0, 10), title: "Review", subject: "Math", topic: topicRef ?? null, status: "PENDING", sortOrder: 0, startTime: null, endTime: null, description: null, coachNote: null, originType: "ANALYSIS", originRefId: "exam", originMeta: { baselineMockExamId: "baseline", subjectRef: "math", ...(topicRef && { topicRef }), source: "LOWEST_AVERAGE", evidenceCount: 1 }, createdAt: new Date(), updatedAt: new Date() } as PlanTaskRow;
    const db = { transaction: async (run: (tx: unknown) => Promise<unknown>) => run({ execute: async () => undefined }) };
    const tasks = { acquireUserLock: vi.fn(), findPendingAnalysisTask: vi.fn(async () => row), create: vi.fn() };
    const events = { emit: vi.fn() };
    const service = new PlanService(db as never, tasks as never, {} as never, events as never);
    const result = await service.createFromAnalysis("user", { examId: "exam", baselineMockExamId: "baseline", expectedSubjectRef: "math", expectedTopicRef: topicRef, title: "Changed draft" }, { subjectName: "Math", source: "LOWEST_AVERAGE", evidenceCount: 1 });
    expect(result.id).toBe("task");
    expect(tasks.findPendingAnalysisTask).toHaveBeenCalledWith(expect.anything(), "user", "exam", "baseline", "math", topicRef);
    expect(tasks.create).not.toHaveBeenCalled();
    expect(events.emit).not.toHaveBeenCalled();
  });
});
