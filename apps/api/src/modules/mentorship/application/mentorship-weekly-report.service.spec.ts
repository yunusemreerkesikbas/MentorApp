import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import type { MentorshipWeeklySnapshotDto } from "@mentor/types";
import { MentorshipEventTopic } from "../domain/mentorship.constants";
import { MentorshipWeeklyReportVersionConflictError } from "../infrastructure/mentorship-weekly-report.repository";
import { MentorshipWeeklyReportService } from "./mentorship-weekly-report.service";

const snapshot: MentorshipWeeklySnapshotDto = {
  period: {
    startDate: "2026-08-31",
    endDate: "2026-09-06",
    previousStartDate: "2026-08-24",
    previousEndDate: "2026-08-30",
    timeZone: "Europe/Istanbul",
  },
  current: {
    focusMinutes: 90,
    sessions: 3,
    activeDays: 3,
    plannedTasks: 4,
    completedTasks: 3,
    completionRate: 0.75,
    hasRecordedActivity: true,
  },
  previous: {
    focusMinutes: 60,
    sessions: 2,
    activeDays: 2,
    plannedTasks: 3,
    completedTasks: 2,
    completionRate: 2 / 3,
    hasRecordedActivity: true,
  },
  deltas: {
    focusMinutes: 30,
    sessions: 1,
    activeDays: 1,
    plannedTasks: 1,
    completedTasks: 1,
    completionRate: 0.75 - 2 / 3,
  },
  subjects: [],
  mocks: {
    examScopeName: null,
    currentAttemptCount: 0,
    previousAttemptCount: 0,
    currentAverageNet: null,
    previousAverageNet: null,
    currentPublishers: [],
    previousPublishers: [],
    subjects: [],
  },
  evidence: [],
  limitations: ["NO_CURRENT_MOCK", "NO_PREVIOUS_MOCK"],
};

function build() {
  const requireActiveLink = vi.fn(async () => ({
    id: "link-1",
    periodId: "period-1",
  }));
  // The student's own side: their live link, whoever the coach is.
  const requireStudentLink = vi.fn(async () => ({
    id: "link-1",
    periodId: "period-1",
    coachId: "coach-1",
  }));
  const listLatestFinalized = vi.fn(async () => ({ rows: [] as unknown[], total: 0 }));
  const events = { emit: vi.fn() };
  const getSnapshot = vi.fn(async () => snapshot);
  const subjectNames = vi.fn(async () => ({ matematik: "Matematik" }));
  const findDraft = vi.fn(async () => null);
  const upsertDraft = vi.fn(async () => ({
    id: "draft-1",
    status: "DRAFT",
    brief: null,
  }));
  const finalize = vi.fn();
  const findFinalized = vi.fn();
  const findFinalizedByOperation = vi.fn(async () => undefined);
  const service = new MentorshipWeeklyReportService(
    { assertEnabled: vi.fn(), requireActiveLink, requireStudentLink } as never,
    { getSnapshot, subjectNames } as never,
    {
      listDisplayIdentities: vi.fn(
        async () =>
          new Map([
            [
              "student-1",
              { displayName: "Ayşe", username: "ayse", examType: "KPSS" },
            ],
            [
              "coach-1",
              { displayName: "Koç Deniz", username: "deniz", examType: "KPSS" },
            ],
          ]),
      ),
      getDiscoveryProfile: vi.fn(async () => ({ examType: "KPSS" })),
    } as never,
    {
      findDraft,
      upsertDraft,
      finalize,
      findFinalized,
      findFinalizedByOperation,
      listLatestFinalized,
    } as never,
    { get: vi.fn(async () => true) } as never,
    events as never,
  );
  return {
    service,
    getSnapshot,
    subjectNames,
    findDraft,
    upsertDraft,
    finalize,
    findFinalized,
    findFinalizedByOperation,
    requireStudentLink,
    listLatestFinalized,
    events,
  };
}

describe("MentorshipWeeklyReportService", () => {
  it("returns a live preview and persists only a draft shell for brief/finalize reuse", async () => {
    const { service, upsertDraft } = build();

    const result = await service.preview("coach-1", "student-1", "2026-08-31");

    expect(result.studentDisplayName).toBe("Ayşe");
    expect(result.sourceFingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(result.snapshot.current.focusMinutes).toBe(90);
    expect(upsertDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        linkId: "link-1",
        periodId: "period-1",
        weekStart: "2026-08-31",
        snapshot,
      }),
    );
  });

  /**
   * Names ride beside the snapshot, never inside it. The fingerprint is a hash of the snapshot, so
   * a name inside it would invalidate every stored draft on deploy, 409 every open "finalize", and
   * shift again whenever content renamed a subject.
   */
  it("names the week's subjects beside the snapshot, leaving the fingerprint alone", async () => {
    const { service, upsertDraft } = build();

    const result = await service.preview("coach-1", "student-1", "2026-08-31");

    expect(result.subjectNames).toEqual({ matematik: "Matematik" });
    expect(result.sourceFingerprint).toBe(
      createHash("sha256").update(JSON.stringify(snapshot)).digest("hex"),
    );
    expect(JSON.stringify(upsertDraft.mock.calls)).not.toContain("Matematik");
  });

  it("names the subjects of a finalized report on the archive and print views", async () => {
    const { service, findFinalized, subjectNames } = build();
    const row = {
      id: "report-1",
      locale: "tr",
      version: 1,
      sourceFingerprint: "f".repeat(64),
      snapshot,
      coachEvaluation: null,
      brief: null,
      replacesId: null,
      finalizedAt: new Date("2026-09-07T10:00:00.000Z"),
    };
    findFinalized.mockResolvedValue(row);

    expect((await service.get("coach-1", "student-1", "report-1")).subjectNames).toEqual({
      matematik: "Matematik",
    });
    expect((await service.share("coach-1", "student-1", "report-1")).subjectNames).toEqual({
      matematik: "Matematik",
    });
    expect(subjectNames).toHaveBeenCalledWith("KPSS", snapshot);
  });

  it("does not reuse a brief created for another language", async () => {
    const { service, findDraft } = build();
    const first = await service.preview(
      "coach-1",
      "student-1",
      "2026-08-31",
      "tr",
    );
    findDraft.mockResolvedValueOnce({
      id: "draft-1",
      sourceFingerprint: first.sourceFingerprint,
      status: "BRIEF_READY",
      briefLocale: "en",
      briefPromptVersion: "v2",
      briefCoachContext: "PRIVATE DIRECTION",
      brief: {
        coachContext: "PRIVATE DIRECTION",
        preparation: { focus: { text: "PRIVATE PREPARATION" } },
        findings: [],
        model: "fake",
        generatedAt: "2026-09-07T10:00:00.000Z",
        locale: "en",
        promptVersion: "v1",
      },
    });

    const result = await service.preview(
      "coach-1",
      "student-1",
      "2026-08-31",
      "tr",
    );
    expect(result.status).toBe("DRAFT");
    expect(result.brief).toBeNull();
  });

  it("refuses to finalize when the preview fingerprint is stale", async () => {
    const { service, finalize } = build();

    await expect(
      service.finalize("coach-1", "student-1", {
        weekStart: "2026-08-31",
        sourceFingerprint: "0".repeat(64),
        operationId: "00000000-0000-4000-8000-000000000001",
        coachEvaluation: "Bu haftanın dengeli dağılımını koruyalım.",
      }),
    ).rejects.toMatchObject({ code: "MENTORSHIP_WEEKLY_REPORT_CONFLICT" });
    expect(finalize).not.toHaveBeenCalled();
  });

  it("replays an already finalized operation even if live source data changed", async () => {
    const { service, findFinalizedByOperation, finalize } = build();
    findFinalizedByOperation.mockResolvedValueOnce({
      id: "report-1",
      locale: "tr",
      version: 1,
      weekStart: "2026-08-31",
      sourceFingerprint: "0".repeat(64),
      snapshot,
      coachEvaluation: "Tekrar gönderim",
      brief: null,
      replacesId: null,
      finalizedAt: new Date("2026-09-07T10:00:00.000Z"),
    });

    const result = await service.finalize("coach-1", "student-1", {
      weekStart: "2026-08-31",
      sourceFingerprint: "0".repeat(64),
      operationId: "00000000-0000-4000-8000-000000000001",
      coachEvaluation: "Tekrar gönderim",
    });

    expect(result.id).toBe("report-1");
    expect(finalize).not.toHaveBeenCalled();
  });

  it("refuses to replay an operationId reused for a different finalization", async () => {
    const { service, findFinalizedByOperation, finalize } = build();
    findFinalizedByOperation.mockResolvedValueOnce({
      id: "report-1",
      locale: "tr",
      version: 1,
      weekStart: "2026-08-31",
      sourceFingerprint: "0".repeat(64),
      snapshot,
      coachEvaluation: "Önceki kayıt",
      brief: null,
      replacesId: null,
      finalizedAt: new Date("2026-09-07T10:00:00.000Z"),
    });

    await expect(
      service.finalize("coach-1", "student-1", {
        weekStart: "2026-08-31",
        sourceFingerprint: "0".repeat(64),
        operationId: "00000000-0000-4000-8000-000000000001",
        coachEvaluation: "Farklı değerlendirme",
      }),
    ).rejects.toMatchObject({ code: "MENTORSHIP_WEEKLY_REPORT_CONFLICT" });
    expect(finalize).not.toHaveBeenCalled();
  });

  it("maps a stale correction reference rejected under the database lock", async () => {
    const { service, finalize } = build();
    const live = await service.preview("coach-1", "student-1", "2026-08-31");
    finalize.mockRejectedValueOnce(
      new MentorshipWeeklyReportVersionConflictError(),
    );

    await expect(
      service.finalize("coach-1", "student-1", {
        weekStart: "2026-08-31",
        sourceFingerprint: live.sourceFingerprint,
        operationId: "00000000-0000-4000-8000-000000000002",
        replacesId: "00000000-0000-4000-8000-000000000003",
      }),
    ).rejects.toMatchObject({ code: "MENTORSHIP_WEEKLY_REPORT_CONFLICT" });
    expect(finalize).toHaveBeenCalledOnce();
  });

  it("lets the repository link an older client finalization to the locked latest version", async () => {
    const { service, finalize } = build();
    const live = await service.preview("coach-1", "student-1", "2026-08-31");
    finalize.mockResolvedValueOnce({
      id: "report-2",
      locale: "tr",
      version: 2,
      weekStart: "2026-08-31",
      sourceFingerprint: live.sourceFingerprint,
      snapshot,
      coachEvaluation: null,
      brief: null,
      replacesId: "report-1",
      finalizedAt: new Date("2026-09-08T10:00:00.000Z"),
    });

    await service.finalize("coach-1", "student-1", {
      weekStart: "2026-08-31",
      sourceFingerprint: live.sourceFingerprint,
      operationId: "00000000-0000-4000-8000-000000000004",
    });

    expect(finalize).toHaveBeenCalledWith(
      expect.objectContaining({ replacesId: null }),
    );
  });

  it("does not expose evidence or the coach-only brief in the printable projection", async () => {
    const { service, findFinalized } = build();
    findFinalized.mockResolvedValueOnce({
      id: "report-1",
      locale: "tr",
      version: 1,
      sourceFingerprint: "f".repeat(64),
      snapshot,
      coachEvaluation: "Ritmi birlikte koruyalım.",
      briefCoachContext: "PRIVATE DIRECTION",
      brief: {
        coachContext: "PRIVATE DIRECTION",
        preparation: { focus: { text: "PRIVATE PREPARATION" } },
        findings: [],
        model: "fake",
        generatedAt: "2026-09-07T10:00:00.000Z",
        locale: "tr",
        promptVersion: "v1",
      },
      replacesId: null,
      finalizedAt: new Date("2026-09-07T10:00:00.000Z"),
    });

    const result = await service.share("coach-1", "student-1", "report-1");
    expect(JSON.stringify(result)).not.toMatch(
      /evidence|brief|conversationQuestion|coachContext|preparation|PRIVATE/,
    );
    expect(result.coachEvaluation).toBe("Ritmi birlikte koruyalım.");
  });

  describe("the student's side", () => {
    const finalized = (over: Record<string, unknown> = {}) => ({
      id: "report-1",
      locale: "tr",
      version: 1,
      weekStart: "2026-08-31",
      sourceFingerprint: "f".repeat(64),
      snapshot,
      coachEvaluation: "Ritmi birlikte koruyalım.",
      briefCoachContext: "PRIVATE DIRECTION",
      brief: { coachContext: "PRIVATE DIRECTION", findings: [], model: "fake" },
      replacesId: null,
      finalizedAt: new Date("2026-09-07T10:00:00.000Z"),
      ...over,
    });

    it("reads the same safe projection the coach prints, through the student's own link", async () => {
      const { service, findFinalized, requireStudentLink } = build();
      findFinalized.mockResolvedValueOnce(finalized());

      const result = await service.shareForStudent("student-1", "report-1");

      expect(requireStudentLink).toHaveBeenCalledWith("student-1");
      expect(findFinalized).toHaveBeenCalledWith("report-1", "link-1", "period-1");
      expect(result).toMatchObject({
        id: "report-1",
        coachDisplayName: "Koç Deniz",
        studentDisplayName: "Ayşe",
        coachEvaluation: "Ritmi birlikte koruyalım.",
      });
      expect(JSON.stringify(result)).not.toMatch(/evidence|brief|coachContext|PRIVATE/);
    });

    it("says 404 for a report outside the student's live link", async () => {
      const { service, findFinalized } = build();
      findFinalized.mockResolvedValueOnce(undefined);
      await expect(service.shareForStudent("student-1", "report-x")).rejects.toMatchObject({
        code: "MENTORSHIP_WEEKLY_REPORT_NOT_FOUND",
      });
    });

    it("lists only the latest version of each week", async () => {
      const { service, listLatestFinalized } = build();
      listLatestFinalized.mockResolvedValueOnce({
        rows: [finalized({ id: "report-2", version: 2, replacesId: "report-1" })],
        total: 1,
      });

      const page = await service.listForStudent("student-1", 1, 20);

      expect(listLatestFinalized).toHaveBeenCalledWith("link-1", "period-1", 1, 20);
      expect(page).toMatchObject({ total: 1, page: 1, pageSize: 20 });
      expect(page.items.map((item) => [item.id, item.version])).toEqual([["report-2", 2]]);
    });

    it("tells the student when the coach finalizes a week, and not again on a replay", async () => {
      const { service, finalize, findFinalizedByOperation, events } = build();
      const live = await service.preview("coach-1", "student-1", "2026-08-31");
      const row = finalized({ sourceFingerprint: live.sourceFingerprint, coachEvaluation: null });
      finalize.mockResolvedValueOnce(row);
      const input = {
        weekStart: "2026-08-31",
        sourceFingerprint: live.sourceFingerprint,
        operationId: "00000000-0000-4000-8000-000000000009",
      };

      await service.finalize("coach-1", "student-1", input);
      expect(events.emit).toHaveBeenCalledTimes(1);
      expect(events.emit).toHaveBeenCalledWith(
        MentorshipEventTopic.WEEKLY_REPORT_FINALIZED,
        expect.objectContaining({
          reportId: "report-1",
          coachId: "coach-1",
          studentId: "student-1",
          coachDisplayName: "Koç Deniz",
        }),
      );

      findFinalizedByOperation.mockResolvedValueOnce(row as never);
      await service.finalize("coach-1", "student-1", input);
      expect(events.emit).toHaveBeenCalledTimes(1);
    });
  });
});
