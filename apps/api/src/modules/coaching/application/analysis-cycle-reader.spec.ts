import { describe, expect, it, vi } from "vitest";
import { AnalysisCycleReader } from "./analysis-cycle-reader";
import type { PlanTaskRow } from "../infrastructure/plan-task.repository";

function fixture({ deleted = false, reviewed = 0, done = false, measured = true } = {}) {
  const task = {
    id: "task", title: "Review", status: done ? "DONE" : "PENDING",
    taskDate: "2026-08-10", createdAt: new Date("2026-08-10T12:00:00Z"),
    originType: "ANALYSIS", originRefId: "exam", subject: "Matematik", topic: null,
    originMeta: { baselineMockExamId: "baseline", subjectRef: "matematik", source: "LOWEST_AVERAGE", evidenceCount: 4 },
  } as PlanTaskRow;
  const mocks = {
    findById: vi.fn(async () => deleted ? undefined : { exam: { id: "baseline", examId: "exam", takenAt: new Date("2026-08-01") }, subjects: [{ subjectRef: "matematik", net: "26.75" }] }),
    findFirstComparableSubjectAttempt: vi.fn(async () => measured ? { exam: { id: "next", takenAt: new Date("2026-08-15") }, net: "28.25" } : undefined),
  };
  const notebook = { focusActivity: vi.fn(async () => ({ matchingCount: 3, reviewedAfterPlanCount: reviewed, dueCount: 1, healedCount: 0 })) };
  const i18n = { translate: vi.fn((key: string) => key) };
  const reader = new AnalysisCycleReader(mocks as never, notebook as never, i18n as never);
  return { mocks, notebook, read: () => reader.read({} as never, "user", task, new Map(), new Map(), new Date("2026-08-20")) };
}

describe("analysis cycle reader", () => {
  it("preserves the task and reports an unmeasurable deleted baseline", async () => {
    const f = fixture({ deleted: true });
    const result = await f.read();
    expect(result).toMatchObject({ task: { id: "task" }, baseline: null, followUp: null, message: "coaching.improvement_cycle.BASELINE_MISSING" });
    expect(f.mocks.findFirstComparableSubjectAttempt).not.toHaveBeenCalled();
  });
  it.each([{ reviewed: 1 }, { done: true }])("records practice independently of comparison (%j)", async (input) => {
    const result = await fixture({ ...input, measured: false }).read();
    expect(result?.steps).toEqual({ planned: true, practiced: true, measured: false, closed: false });
  });
  it("compares the fixed subject with a neutral signed difference", async () => {
    const result = await fixture({ reviewed: 1 }).read();
    expect(result).toMatchObject({ baseline: { net: "26.75" }, followUp: { net: "28.25", delta: "+1.50" }, steps: { closed: true } });
  });
});
