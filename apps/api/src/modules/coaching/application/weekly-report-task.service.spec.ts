import { describe, expect, it, vi } from "vitest";
import { WeeklyReportTaskService } from "./weekly-report-task.service";

function harness(existing = false) {
  const row = { id: "task", status: "DONE", taskDate: "2026-11-05", originType: "WEEKLY_REPORT",
    originRefId: "report", originMeta: { examId: "exam", weekStart: "2026-10-26", subjectRef: "math", baselineAverageNet: "10.00" } };
  const db = { transaction: async (run: (tx: unknown) => Promise<unknown>) => run({ execute: vi.fn() }) };
  const tasks = { acquireUserLock: vi.fn(), create: vi.fn(async () => row) };
  const reports = { find: vi.fn(async () => existing ? row : undefined) };
  const events = { emit: vi.fn() };
  const service = new WeeklyReportTaskService(db as never, tasks as never, reports as never, events as never);
  const evidence = { reportId: "report", examId: "exam", weekStart: "2026-10-26",
    subjectRef: "math", subjectName: "Mathematics", baselineAverageNet: "10.00" };
  return { service, tasks, events, evidence };
}

describe("weekly report plan persistence", () => {
  it("reuses a completed task on retry without creating or publishing again", async () => {
    const h = harness(true);
    expect(await h.service.create("user", { title: "Retry", taskDate: "2000-01-01" }, h.evidence)).toMatchObject({ id: "task", status: "DONE" });
    expect(h.tasks.acquireUserLock).toHaveBeenCalled();
    expect(h.tasks.create).not.toHaveBeenCalled();
    expect(h.events.emit).not.toHaveBeenCalled();
  });
  it("creates one task with server-resolved subject and structural provenance", async () => {
    const h = harness();
    await h.service.create("user", { title: "Edited", taskDate: "2099-01-01" }, h.evidence);
    expect(h.tasks.create).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      userId: "user", title: "Edited", subject: "Mathematics", originType: "WEEKLY_REPORT", originRefId: "report",
      originMeta: { examId: "exam", weekStart: "2026-10-26", subjectRef: "math", baselineAverageNet: "10.00" },
    }));
    expect(h.events.emit).toHaveBeenCalledOnce();
  });
  it("rejects new tasks in the past", async () => {
    const h = harness();
    await expect(h.service.create("user", { title: "Past", taskDate: "2000-01-01" }, h.evidence))
      .rejects.toMatchObject({ code: "COACHING_TASK_DATE_READONLY" });
    expect(h.tasks.create).not.toHaveBeenCalled();
  });
});
