import { beforeEach, describe, expect, it, vi } from "vitest";
import { MentorshipSelfViewService } from "./mentorship-self-view.service";

const STUDENT = "student-a";

function snapshot(over: Record<string, unknown> = {}) {
  return {
    activity: {
      lastActiveDate: "2026-09-05",
      currentStreak: 3,
      longestStreak: 11,
      sessions7d: 4,
      focusMinutes7d: 130,
      activeDays7d: 3,
      sessions28d: 12,
      focusMinutes28d: 540,
      activeDays28d: 9,
    },
    planCompletionRate7d: 0.4,
    mockTrend: [
      { takenAt: "2026-09-04", totalNet: 62, publisherName: "X" },
      { takenAt: "2026-08-28", totalNet: 58, publisherName: "X" },
    ],
    latestMockSubjects: [
      { subjectRef: "Matematik", correct: 12, wrong: 4, blank: 4, net: 11 },
    ],
    planTasks: [
      { taskDate: "2026-09-05", title: "Paragraf", subject: "Türkçe", topic: null, status: "DONE" },
    ],
    moodTrend: [
      { date: "2026-09-03", level: 3 },
      { date: "2026-09-04", level: 4 },
      { date: "2026-09-05", level: 4 },
    ],
    ...over,
  };
}

describe("MentorshipSelfViewService", () => {
  let assertEnabled: ReturnType<typeof vi.fn>;
  let findActiveByStudent: ReturnType<typeof vi.fn>;
  let getStudentReport: ReturnType<typeof vi.fn>;
  let service: MentorshipSelfViewService;

  function build(over: Record<string, unknown> = {}) {
    assertEnabled = vi.fn(async () => undefined);
    findActiveByStudent = vi.fn(async () => ({ id: "link-1", coachId: "coach-1" }));
    getStudentReport = vi.fn(async () => snapshot(over));
    service = new MentorshipSelfViewService(
      { assertEnabled } as never,
      { findActiveByStudent } as never,
      { getStudentReport } as never,
      { getDiscoveryProfile: vi.fn(async () => ({ examType: "KPSS" })) } as never,
    );
  }

  beforeEach(() => build());

  it("refuses before reading anything when the surface is off", async () => {
    assertEnabled.mockRejectedValueOnce(new Error("MENTORSHIP_DISABLED"));
    await expect(service.getSharedData(STUDENT)).rejects.toThrow("MENTORSHIP_DISABLED");
    expect(getStudentReport).not.toHaveBeenCalled();
  });

  it("mirrors nothing when no coach is reading", async () => {
    findActiveByStudent.mockResolvedValueOnce(undefined);
    await expect(service.getSharedData(STUDENT)).resolves.toBeNull();
    // Nothing is being shared, so nothing is computed either.
    expect(getStudentReport).not.toHaveBeenCalled();
  });

  it("asks for the snapshot WITHOUT a link id, which is what keeps the coach's own words out", async () => {
    // The load-bearing assertion of this file. `coachNote` and `assignedByCoach` are absent because
    // the third argument was never passed — not because something filtered them afterwards.
    await service.getSharedData(STUDENT);
    expect(getStudentReport).toHaveBeenCalledTimes(1);
    expect(getStudentReport.mock.calls[0]![2]).toBeUndefined();
  });

  it("reports the activity window it actually read over", async () => {
    const result = await service.getSharedData(STUDENT);
    expect(result!.activity).toEqual({
      windowDays: 7,
      sessions7d: 4,
      focusMinutes7d: 130,
      activeDays7d: 3,
      currentStreak: 3,
      longestStreak: 11,
      lastActiveDate: "2026-09-05",
    });
  });

  it("carries two windows for plan tasks, because the titles and the rate cover different spans", async () => {
    const result = await service.getSharedData(STUDENT);
    expect(result!.planTasks).toEqual({
      titleWindowDays: 14,
      titleCount: 1,
      planCompletionRate7d: 0.4,
    });
  });

  it("averages mood to one decimal, server-side", async () => {
    const result = await service.getSharedData(STUDENT);
    expect(result!.mood).toEqual({ windowDays: 14, count: 3, average: 3.7 });
  });

  it("points at the mock exams instead of restating them", async () => {
    const result = await service.getSharedData(STUDENT);
    // Count and date only: the nets and the subject breakdown are on the student's own screen.
    expect(result!.mockExams).toEqual({ count: 2, latestAt: "2026-09-04" });
    expect(JSON.stringify(result)).not.toContain("Matematik");
    expect(JSON.stringify(result)).not.toContain("62");
  });

  it("says nothing rather than reporting a row of zeroes for a student who never started", async () => {
    build({
      activity: {
        lastActiveDate: null,
        currentStreak: 0,
        longestStreak: 0,
        sessions7d: 0,
        focusMinutes7d: 0,
        activeDays7d: 0,
        sessions28d: 0,
        focusMinutes28d: 0,
        activeDays28d: 0,
      },
      planCompletionRate7d: null,
      planTasks: [],
      moodTrend: [],
      mockTrend: [],
    });
    const result = await service.getSharedData(STUDENT);
    expect(result).toEqual({
      activity: null,
      planTasks: null,
      mood: null,
      mockExams: null,
      examType: "KPSS",
    });
  });

  it("still reports a plan rate of zero — planned and not done is a fact, not an absence", async () => {
    build({ planTasks: [], planCompletionRate7d: 0 });
    const result = await service.getSharedData(STUDENT);
    expect(result!.planTasks).toMatchObject({ titleCount: 0, planCompletionRate7d: 0 });
  });
});
