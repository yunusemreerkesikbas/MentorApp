import { describe, expect, it, vi } from "vitest";
import { MentorshipWeeklyEvidenceService } from "./mentorship-weekly-evidence.service";

describe("MentorshipWeeklyEvidenceService", () => {
  it("builds the selected completed week from the scoped repository evidence", async () => {
    const getEvidence = vi
      .fn()
      .mockResolvedValue({ sessions: [], tasks: [], mocks: [] });
    const service = new MentorshipWeeklyEvidenceService(
      { getEvidence } as never,
      { get: vi.fn(async () => 60) } as never,
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
