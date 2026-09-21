import { describe, expect, it, vi } from "vitest";
import type { MentorshipWeeklyReportPreviewDto } from "@mentor/types";
import {
  MentorshipWeeklyBriefService,
  weeklyBriefFingerprint,
} from "./mentorship-weekly-brief.service";

const sourceFingerprint = "a".repeat(64);
const input = { weekStart: "2026-08-31", sourceFingerprint };
const coach = { id: "coach-1", roles: ["COACH"] };
const payload = {
  ...input,
  draftId: "draft-1",
  coachId: coach.id,
  studentId: "student-1",
  locale: "tr" as const,
  promptVersion: "v2",
  generationId: "11111111-1111-4111-8111-111111111111",
  briefFingerprint: weeklyBriefFingerprint(sourceFingerprint, null, "tr"),
};
const preview = {
  draftId: "draft-1",
  studentId: "student-1",
  sourceFingerprint,
  status: "DRAFT",
  brief: null,
  snapshot: {},
} as MentorshipWeeklyReportPreviewDto;
const pending = {
  ...preview,
  status: "BRIEF_PENDING" as const,
  briefGenerationId: payload.generationId,
  briefFingerprint: payload.briefFingerprint,
  coachContext: null,
};
function build(state = preview) {
  const read = vi.fn().mockResolvedValue(state);
  const repo = {
    markBriefPending: vi.fn().mockResolvedValue(true),
    markBriefStarted: vi.fn().mockResolvedValue(true),
    setBriefResult: vi.fn().mockResolvedValue(true),
  };
  const enqueue = vi.fn();
  const generate = vi
    .fn()
    .mockResolvedValue({ findings: [], preparation: {}, model: "fake" });
  const service = new MentorshipWeeklyBriefService(
    { preview: read } as never,
    repo as never,
    { enqueue } as never,
    { generate } as never,
  );
  return { service, read, repo, enqueue, generate };
}

describe("weekly meeting preparation lifecycle", () => {
  it("queues trimmed private context without putting text or roles in the job", async () => {
    const b = build();
    const result = await b.service.request(
      coach,
      "student-1",
      { ...input, coachContext: "  workload  " },
      "tr",
    );
    expect(result.coachContext).toBe("workload");
    expect(b.repo.markBriefPending).toHaveBeenCalledWith(
      expect.objectContaining({
        briefFingerprint: weeklyBriefFingerprint(
          sourceFingerprint,
          "workload",
          "tr",
        ),
      }),
      "workload",
    );
    const job = b.enqueue.mock.calls[0]![1];
    expect(job).not.toHaveProperty("coachContext");
    expect(job).not.toHaveProperty("coachRoles");
    expect(b.enqueue.mock.calls[0]![2]).toEqual({ maxAttempts: 1 });
  });
  it.each(["BRIEF_READY", "BRIEF_PENDING"] as const)(
    "reuses identical %s input",
    async (status) => {
      const state = {
        ...pending,
        status,
        brief: status === "BRIEF_READY" ? { findings: [] } : null,
      } as MentorshipWeeklyReportPreviewDto;
      const b = build(state);
      expect(
        await b.service.request(
          coach,
          "student-1",
          { ...input, coachContext: "  " },
          "tr",
        ),
      ).toBe(state);
      expect(b.enqueue).not.toHaveBeenCalled();
    },
  );
  it("regenerates ready output when direction changes", async () => {
    const b = build({
      ...pending,
      status: "BRIEF_READY",
      brief: { findings: [] },
    } as MentorshipWeeklyReportPreviewDto);
    await b.service.request(
      coach,
      "student-1",
      { ...input, coachContext: "new direction" },
      "tr",
    );
    expect(b.enqueue).toHaveBeenCalledOnce();
  });
  it("refuses different input while pending", async () => {
    const b = build(pending);
    await expect(
      b.service.request(
        coach,
        "student-1",
        { ...input, coachContext: "new" },
        "tr",
      ),
    ).rejects.toThrow("MENTORSHIP_WEEKLY_REPORT_CONFLICT");
    expect(b.repo.markBriefPending).not.toHaveBeenCalled();
  });
  it("reuses the winner of a concurrent identical claim", async () => {
    const b = build();
    b.repo.markBriefPending.mockResolvedValue(false);
    b.read.mockResolvedValueOnce(preview).mockResolvedValueOnce(pending);
    expect(await b.service.request(coach, "student-1", input, "tr")).toBe(
      pending,
    );
    expect(b.enqueue).not.toHaveBeenCalled();
  });
  it("rejects changed evidence before claiming", async () => {
    const b = build({ ...preview, sourceFingerprint: "b".repeat(64) });
    await expect(
      b.service.request(coach, "student-1", input, "tr"),
    ).rejects.toThrow();
    expect(b.repo.markBriefPending).not.toHaveBeenCalled();
  });
  it("marks exactly the claimed generation failed if enqueue fails", async () => {
    const b = build();
    b.enqueue.mockRejectedValue(new Error("queue unavailable"));
    await expect(
      b.service.request(coach, "student-1", input, "tr"),
    ).rejects.toThrow("queue unavailable");
    expect(b.repo.setBriefResult).toHaveBeenCalledWith(
      b.enqueue.mock.calls[0]![1],
      null,
    );
  });
  it("persists preparation with its bound context and checks fresh roles", async () => {
    const b = build({ ...pending, coachContext: "workload" });
    await b.service.handle(payload);
    expect(b.generate).toHaveBeenCalledWith(
      {},
      { id: coach.id, roles: undefined },
      "tr",
      "workload",
    );
    expect(b.repo.setBriefResult).toHaveBeenCalledWith(
      payload,
      expect.objectContaining({ coachContext: "workload", preparation: {} }),
    );
  });
  it.each([
    "sourceFingerprint",
    "briefGenerationId",
    "briefFingerprint",
  ] as const)("does not dispatch stale %s", async (field) => {
    const b = build({ ...pending, [field]: "changed" });
    await b.service.handle(payload);
    expect(b.generate).not.toHaveBeenCalled();
  });
  it("does not call the provider again on duplicate job delivery", async () => {
    const b = build(pending);
    b.repo.markBriefStarted.mockResolvedValue(false);
    await b.service.handle(payload);
    expect(b.generate).not.toHaveBeenCalled();
  });
  it("does not save a result after the evidence changes", async () => {
    const b = build(pending);
    b.read
      .mockResolvedValueOnce(pending)
      .mockResolvedValueOnce({ ...pending, sourceFingerprint: "b".repeat(64) });
    await b.service.handle(payload);
    expect(b.repo.setBriefResult).not.toHaveBeenCalled();
  });
  it("does not save private output after access is revoked", async () => {
    const b = build(pending);
    b.read
      .mockResolvedValueOnce(pending)
      .mockRejectedValueOnce(new Error("link ended"));
    await expect(b.service.handle(payload)).rejects.toThrow("link ended");
    expect(b.repo.setBriefResult).toHaveBeenCalledWith(payload, null);
  });
  it("marks provider or quota errors failed without retrying the provider", async () => {
    const b = build(pending);
    b.generate.mockRejectedValue(new Error("quota"));
    await expect(b.service.handle(payload)).rejects.toThrow("quota");
    expect(b.repo.setBriefResult).toHaveBeenCalledWith(payload, null);
    expect(b.generate).toHaveBeenCalledOnce();
  });
  it("ignores obsolete prompts and rejects malformed current jobs", async () => {
    const b = build();
    await b.service.handle({ promptVersion: "v1" });
    await expect(b.service.handle({ promptVersion: "v2" })).rejects.toThrow();
    expect(b.read).not.toHaveBeenCalled();
  });
  it("fingerprints data, direction and locale separately", () => {
    expect(
      new Set([
        weeklyBriefFingerprint(sourceFingerprint, null, "tr"),
        weeklyBriefFingerprint(sourceFingerprint, "workload", "tr"),
        weeklyBriefFingerprint(sourceFingerprint, null, "en"),
        weeklyBriefFingerprint("b".repeat(64), null, "tr"),
      ]).size,
    ).toBe(4);
  });
});
