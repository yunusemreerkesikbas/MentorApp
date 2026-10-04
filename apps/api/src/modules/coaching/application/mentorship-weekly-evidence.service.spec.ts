import { describe, expect, it, vi } from "vitest";
import type { MentorshipWeeklySnapshotDto } from "@mentor/types";
import { MentorshipWeeklyEvidenceService } from "./mentorship-weekly-evidence.service";

function namingService(examId: string | null) {
  const content = {
    // No dated exam: YKS/LGS rows carry no calendar, and a KPSS date passes. Names must not need one.
    getExamCalendar: vi.fn(async () => null),
    getTaxonomyExamId: vi.fn(async () => examId),
    listExamSubjects: vi.fn(async () => [
      { slug: "matematik", name: "Matematik", questionCount: 30, sortOrder: 1 },
      { slug: "turkce", name: "Türkçe", questionCount: 30, sortOrder: 0 },
      { slug: "tarih", name: "Tarih", questionCount: 27, sortOrder: 2 },
    ]),
  };
  const service = new MentorshipWeeklyEvidenceService(
    { getEvidence: vi.fn() } as never,
    { get: vi.fn() } as never,
    content as never,
  );
  return { service, content };
}

const namedWeek = {
  period: { endDate: "2026-09-06" },
  subjects: [{ subjectRef: "matematik" }, { subjectRef: null }],
  mocks: { subjects: [{ subjectRef: "turkce" }, { subjectRef: "eski-ders" }] },
} as unknown as MentorshipWeeklySnapshotDto;

describe("MentorshipWeeklyEvidenceService", () => {
  it("names only the subjects the week carries, from the taxonomy the planner offers, with no exam date", async () => {
    const { service, content } = namingService("exam-1");
    await expect(service.subjectNames("KPSS", namedWeek)).resolves.toEqual({
      matematik: "Matematik",
      turkce: "Türkçe",
    });
    expect(content.getTaxonomyExamId).toHaveBeenCalledWith("KPSS");
    expect(content.listExamSubjects).toHaveBeenCalledWith("exam-1");
  });

  it("names nothing when the student's exam cannot be resolved", async () => {
    const { service, content } = namingService(null);
    await expect(service.subjectNames("KPSS", namedWeek)).resolves.toEqual({});
    expect(content.listExamSubjects).not.toHaveBeenCalled();
  });

  it("builds the selected completed week from the scoped repository evidence", async () => {
    const getEvidence = vi
      .fn()
      .mockResolvedValue({ sessions: [], tasks: [], mocks: [] });
    const service = new MentorshipWeeklyEvidenceService(
      { getEvidence } as never,
      { get: vi.fn(async () => 60) } as never,
      {} as never,
    );

    const result = await service.getSnapshot(
      "student-1",
      "KPSS",
      "2026-08-31",
      new Date("2026-09-13T09:00:00.000Z"),
    );

    expect(getEvidence).toHaveBeenCalledWith(
      "student-1",
      "KPSS",
      expect.objectContaining({
        startDate: "2026-08-31",
        previousStartDate: "2026-08-24",
      }),
    );
    expect(result.period.startDate).toBe("2026-08-31");
    expect(result.limitations).toContain("NO_CURRENT_ACTIVITY");
  });

  it("rejects an unfinished week before reading student data", async () => {
    const getEvidence = vi.fn();
    const service = new MentorshipWeeklyEvidenceService(
      { getEvidence } as never,
      { get: vi.fn(async () => 60) } as never,
      {} as never,
    );

    await expect(
      service.getSnapshot(
        "student-1",
        "KPSS",
        "2026-09-07",
        new Date("2026-09-13T09:00:00.000Z"),
      ),
    ).rejects.toThrow("MENTORSHIP_WEEK_INVALID");
    expect(getEvidence).not.toHaveBeenCalled();
  });

  it("uses the recap minimum when counting focus sessions", async () => {
    const getEvidence = vi.fn().mockResolvedValue({
      sessions: [
        {
          endedAt: new Date("2026-09-01T10:00:00.000Z"),
          focusSeconds: 59,
          subject: "math",
        },
        {
          endedAt: new Date("2026-09-02T10:00:00.000Z"),
          focusSeconds: 60,
          subject: "math",
        },
      ],
      tasks: [],
      mocks: [],
    });
    const service = new MentorshipWeeklyEvidenceService(
      { getEvidence } as never,
      { get: vi.fn(async () => 60) } as never,
      {} as never,
    );

    const result = await service.getSnapshot(
      "student-1",
      "KPSS",
      "2026-08-31",
      new Date("2026-09-13T09:00:00.000Z"),
    );

    expect(result.current.sessions).toBe(1);
    expect(result.current.focusMinutes).toBe(1);
  });
});
