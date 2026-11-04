import { describe, expect, it, vi } from "vitest";
import { WeeklyReportFollowUpService } from "./weekly-report-follow-up.service";

function harness(status = "READY") {
  const report = { id: "r1", status, examId: "exam", weekStart: "2026-10-26",
    review: { period: { endDate: "2026-11-01" }, focus: { subjectRef: "math" },
      suggestedTask: { title: "Review", subject: "Mathematics" },
      deepAnalysis: { subjects: [{ subjectRef: "math", averageNet: "12.00" }] } } };
  const reports = { byId: vi.fn(async () => report), find: vi.fn(async () => undefined) };
  const tasks = { create: vi.fn(async () => ({ id: "task" })), find: vi.fn(async () => null),
    measure: vi.fn(async () => null) };
  const service = new WeeklyReportFollowUpService(reports as never, tasks as never,
    { translate: (key: string) => key } as never);
  return { service, reports, tasks, report };
}

describe("weekly report recommendation ownership", () => {
  it("does not invent a baseline or an exam comparison for rhythm-only steps", async () => {
    const h = harness();
    h.reports.find.mockResolvedValue({ ...h.report, id: "previous", review: {
      ...h.report.review, focus: null, deepAnalysis: undefined,
    } } as never);
    h.tasks.find.mockImplementation(async (_u?: string, id?: string) => id === "previous"
      ? { task: { id: "task", status: "DONE" }, createdAt: new Date() } as never : null);
    const result = await h.service.get("user", "r1");
    expect(result.previous).toMatchObject({ baselineNet: null, measurement: null });
    expect(result.previous?.message).toContain("WEEKLY_FOLLOW_UP_RHYTHM");
    expect(h.tasks.measure).not.toHaveBeenCalled();
  });
  it("bounds the next measurement to the displayed week's end and computes the difference on the server", async () => {
    const h = harness();
    h.reports.find.mockResolvedValue({ ...h.report, id: "previous", weekStart: "2026-10-19" } as never);
    h.tasks.find.mockImplementation(async (_u?: string, id?: string) => id === "previous"
      ? { task: { id: "task", status: "DONE" }, createdAt: new Date("2026-10-26T10:00:00Z") } as never : null);
    h.tasks.measure.mockResolvedValue({ net: "15.00", takenAt: new Date("2026-10-30T10:00:00Z") } as never);
    const result = await h.service.get("user", "r1");
    expect(result.previous?.measurement).toMatchObject({ net: "15.00", delta: "+3.00" });
    expect(h.tasks.measure).toHaveBeenCalledWith("user", "exam", "math", new Date("2026-10-26T10:00:00Z"), new Date("2026-11-01T21:00:00Z"));
    expect(result.previous?.message).toContain("WEEKLY_FOLLOW_UP_MEASURED");
  });
  it("rejects missing or unopened reports before touching plan data", async () => {
    const h = harness("GENERATED");
    await expect(h.service.create("user", "r1", { title: "Edited" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(h.tasks.create).not.toHaveBeenCalled();
    h.reports.byId.mockResolvedValue(undefined as never);
    await expect(h.service.get("user", "foreign")).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(h.tasks.find).not.toHaveBeenCalled();
  });

  it("binds edited tasks to the saved report, subject and baseline", async () => {
    const h = harness();
    await h.service.create("user", "r1", { title: "Edited", taskDate: "2026-11-05" });
    expect(h.tasks.create).toHaveBeenCalledWith("user", { title: "Edited", taskDate: "2026-11-05" }, {
      reportId: "r1", examId: "exam", weekStart: "2026-10-26", subjectRef: "math",
      subjectName: "Mathematics", baselineAverageNet: "12.00",
    });
  });

  it("does not create a task when the saved report has no recommendation", async () => {
    const h = harness(); h.report.review.suggestedTask = null as never;
    await expect(h.service.create("user", "r1", { title: "Forged" })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(h.tasks.create).not.toHaveBeenCalled();
  });

  it("keeps first-report state empty and never reads another user's report", async () => {
    const h = harness();
    expect(await h.service.get("user", "r1")).toEqual({ task: null, previous: null });
    expect(h.reports.byId).toHaveBeenCalledWith("user", "r1");
    expect(h.reports.find).toHaveBeenCalledWith("user", "exam", "2026-10-19");
    expect(h.tasks.measure).not.toHaveBeenCalled();
  });
});
