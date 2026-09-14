import { describe, expect, it, vi } from "vitest";
import type { MentorshipWeeklyReportPreviewDto } from "@mentor/types";
import { MentorshipWeeklyBriefService } from "./mentorship-weekly-brief.service";

const preview = {
  draftId: "draft-1",
  studentId: "student-1",
  studentDisplayName: "Ayşe",
  sourceFingerprint: "a".repeat(64),
  status: "DRAFT",
  snapshot: { evidence: [], limitations: [] },
  brief: null,
} as unknown as MentorshipWeeklyReportPreviewDto;

describe("MentorshipWeeklyBriefService", () => {
  it("queues generation and returns pending without calling the model", async () => {
    const enqueue = vi.fn(async () => ({ jobId: "job-1" }));
    const generate = vi.fn();
    const service = new MentorshipWeeklyBriefService(
      { preview: vi.fn(async () => preview) } as never,
      {
        markBriefPending: vi.fn(async () => true),
        setBriefResult: vi.fn(),
      } as never,
      { enqueue } as never,
      { generate } as never,
    );

    const result = await service.request(
      { id: "coach-1", roles: ["COACH"] },
      "student-1",
      { weekStart: "2026-08-31", sourceFingerprint: "a".repeat(64) },
      "tr",
    );

    expect(result.status).toBe("BRIEF_PENDING");
    expect(generate).not.toHaveBeenCalled();
    expect(enqueue).toHaveBeenCalledWith(
      "mentorship.generate-weekly-brief",
      expect.objectContaining({
        draftId: "draft-1",
        sourceFingerprint: "a".repeat(64),
      }),
      { maxAttempts: 1 },
    );
  });

  it("rechecks the fingerprint after generation before storing findings", async () => {
    const readPreview = vi
      .fn()
      .mockResolvedValueOnce(preview)
      .mockResolvedValueOnce({ ...preview, sourceFingerprint: "b".repeat(64) });
    const setBriefResult = vi.fn();
    const service = new MentorshipWeeklyBriefService(
      { preview: readPreview } as never,
      { markBriefPending: vi.fn(async () => true), setBriefResult } as never,
      { enqueue: vi.fn() } as never,
      {
        generate: vi.fn(async () => ({ findings: [], model: "fake" })),
      } as never,
    );

    await service.handle({
      draftId: "draft-1",
      coachId: "coach-1",
      studentId: "student-1",
      weekStart: "2026-08-31",
      sourceFingerprint: "a".repeat(64),
      locale: "tr",
      promptVersion: "v1",
    });

    expect(setBriefResult).not.toHaveBeenCalled();
  });

  it("reuses a ready brief without enqueueing another job", async () => {
    const enqueue = vi.fn();
    const ready = {
      ...preview,
      status: "BRIEF_READY",
      brief: {
        findings: [],
        model: "fake",
        generatedAt: "2026-09-07T10:00:00.000Z",
        locale: "tr",
        promptVersion: "v1",
      },
    } as MentorshipWeeklyReportPreviewDto;
    const service = new MentorshipWeeklyBriefService(
      { preview: vi.fn(async () => ready) } as never,
      { markBriefPending: vi.fn(), setBriefResult: vi.fn() } as never,
      { enqueue } as never,
      { generate: vi.fn() } as never,
    );

    const result = await service.request(
      { id: "coach-1", roles: ["COACH"] },
      "student-1",
      { weekStart: "2026-08-31", sourceFingerprint: "a".repeat(64) },
      "tr",
    );

    expect(result).toBe(ready);
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("does not enqueue a second job while the same brief is pending", async () => {
    const enqueue = vi.fn();
    const markBriefPending = vi.fn();
    const pending = {
      ...preview,
      status: "BRIEF_PENDING",
    } as MentorshipWeeklyReportPreviewDto;
    const service = new MentorshipWeeklyBriefService(
      { preview: vi.fn(async () => pending) } as never,
      { markBriefPending, setBriefResult: vi.fn() } as never,
      { enqueue } as never,
      { generate: vi.fn() } as never,
    );

    const result = await service.request(
      { id: "coach-1", roles: ["COACH"] },
      "student-1",
      { weekStart: "2026-08-31", sourceFingerprint: "a".repeat(64) },
      "tr",
    );

    expect(result).toBe(pending);
    expect(markBriefPending).not.toHaveBeenCalled();
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("does not enqueue when another request claims the draft first", async () => {
    const enqueue = vi.fn();
    const pending = {
      ...preview,
      status: "BRIEF_PENDING",
    } as MentorshipWeeklyReportPreviewDto;
    const readPreview = vi
      .fn()
      .mockResolvedValueOnce(preview)
      .mockResolvedValueOnce(pending);
    const service = new MentorshipWeeklyBriefService(
      { preview: readPreview } as never,
      {
        markBriefPending: vi.fn(async () => false),
        setBriefResult: vi.fn(),
      } as never,
      { enqueue } as never,
      { generate: vi.fn() } as never,
    );

    const result = await service.request(
      { id: "coach-1", roles: ["COACH"] },
      "student-1",
      { weekStart: "2026-08-31", sourceFingerprint: "a".repeat(64) },
      "tr",
    );

    expect(result).toBe(pending);
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("marks the draft failed when queue insertion fails", async () => {
    const queueError = new Error("queue unavailable");
    const setBriefResult = vi.fn();
    const service = new MentorshipWeeklyBriefService(
      { preview: vi.fn(async () => preview) } as never,
      { markBriefPending: vi.fn(async () => true), setBriefResult } as never,
      { enqueue: vi.fn(async () => Promise.reject(queueError)) } as never,
      { generate: vi.fn() } as never,
    );

    await expect(
      service.request(
        { id: "coach-1", roles: ["COACH"] },
        "student-1",
        { weekStart: "2026-08-31", sourceFingerprint: "a".repeat(64) },
        "tr",
      ),
    ).rejects.toBe(queueError);
    expect(setBriefResult).toHaveBeenCalledWith(
      "draft-1",
      "a".repeat(64),
      "tr",
      "v1",
      null,
    );
  });

  it("rejects malformed queue payloads before reading or calling the model", async () => {
    const readPreview = vi.fn();
    const generate = vi.fn();
    const service = new MentorshipWeeklyBriefService(
      { preview: readPreview } as never,
      { markBriefPending: vi.fn(), setBriefResult: vi.fn() } as never,
      { enqueue: vi.fn() } as never,
      { generate } as never,
    );

    await expect(service.handle({ studentId: "student-1" })).rejects.toThrow();
    expect(readPreview).not.toHaveBeenCalled();
    expect(generate).not.toHaveBeenCalled();
  });

  it("does not persist generated findings when access disappears during the job", async () => {
    const readPreview = vi
      .fn()
      .mockResolvedValueOnce(preview)
      .mockRejectedValueOnce(new Error("link ended"));
    const setBriefResult = vi.fn();
    const service = new MentorshipWeeklyBriefService(
      { preview: readPreview } as never,
      { markBriefPending: vi.fn(), setBriefResult } as never,
      { enqueue: vi.fn() } as never,
      {
        generate: vi.fn(async () => ({
          findings: [{ observation: "private" }],
          model: "fake",
        })),
      } as never,
    );

    await expect(
      service.handle({
        draftId: "draft-1",
        coachId: "coach-1",
        studentId: "student-1",
        weekStart: "2026-08-31",
        sourceFingerprint: "a".repeat(64),
        locale: "tr",
        promptVersion: "v1",
      }),
    ).rejects.toThrow("link ended");
    expect(setBriefResult).toHaveBeenCalledWith(
      "draft-1",
      "a".repeat(64),
      "tr",
      "v1",
      null,
    );
  });
});
