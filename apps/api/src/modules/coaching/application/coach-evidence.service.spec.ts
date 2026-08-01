import { CoachEvidenceType } from "@mentor/types";
import { CoachEvidenceService } from "./coach-evidence.service";

const now = new Date("2026-08-01T12:00:00.000Z");

function makeService(
  options: {
    dailyFocusGoalMinutes?: number | null;
    taskSubjects?: Array<string | null>;
    dominantTimeBand?: "MORNING" | "AFTERNOON" | "EVENING" | null;
  } = {},
) {
  const users = {
    getMe: vi.fn(async () => ({
      examType: "YKS",
      dailyFocusGoalMinutes:
        options.dailyFocusGoalMinutes === undefined
          ? 120
          : options.dailyFocusGoalMinutes,
      displayName: "Gizli İsim",
      email: "hidden@example.com",
    })),
  };
  const plan = {
    listForDate: vi.fn(async () =>
      (options.taskSubjects ?? ["matematik", "Bilinmeyen", "Matematik"]).map(
        (subject, index) => ({
          title: `Ham görev başlığı ${index}`,
          subject,
          status: index === 0 ? "DONE" : "PENDING",
        }),
      ),
    ),
    getAiCoachOutcomeSummary: vi.fn(async () => ({
      accepted: 2,
      completed: 1,
      lastStatus: "DONE",
      observedAt: now,
      pendingTaskId: "00000000-0000-4000-8000-000000000010",
    })),
  };
  const sessions = {
    getCoachRhythm: vi.fn(async () => ({
      todayFocusMinutes: 35,
      sessions7d: 4,
      focusMinutes7d: 170,
      activeDays7d: 3,
      averageSessionMinutes7d: 43,
      sessions28d: 12,
      focusMinutes28d: 520,
      activeDays28d: 10,
      averageSessionMinutes28d: 43,
      dominantTimeBand:
        options.dominantTimeBand === undefined
          ? "EVENING"
          : options.dominantTimeBand,
      lastActiveAt: now.toISOString(),
    })),
  };
  const moods = {
    getCoachMoodEvidence: vi.fn(async () => ({
      today: 2,
      trend: "DOWN",
      observedAt: now,
    })),
  };
  const streak = {
    getCoachEvidence: vi.fn(async () => ({
      currentStreak: 3,
      lastActiveDate: "2026-08-01",
    })),
  };
  const mockExams = {
    list: vi.fn(async () => ({
      items: [{ totalNet: "61.25", takenAt: now.toISOString() }],
      total: 4,
      page: 1,
      pageSize: 1,
    })),
    getAnalysis: vi.fn(async () => ({
      trend: [
        { totalNet: "61.25", takenAt: now.toISOString() },
        { totalNet: "58.00", takenAt: "2026-07-20T12:00:00.000Z" },
      ],
      nextFocus: { subjectRef: "matematik", subjectName: "Matematik" },
    })),
  };
  const vision = {
    getMine: vi.fn(async () => ({
      goalTitle: "Doktor olmak istiyorum - ham metin",
      motivation: "Aileme söz verdim - ham metin",
      careerGroup: "SAGLIK",
      targetCityCode: "34",
      targetCity: null,
      targetUniversityId: null,
      updatedAt: now.toISOString(),
    })),
  };
  const content = {
    getExamCalendar: vi.fn(async () => ({ examId: "exam-1" })),
    listExamSubjects: vi.fn(async () => [
      { slug: "matematik", name: "Matematik" },
    ]),
  };
  const i18n = {
    translate: vi.fn(
      (key: string, options?: { args?: Record<string, unknown> }) =>
        `${key}:${JSON.stringify(options?.args ?? {})}`,
    ),
  };

  return new CoachEvidenceService(
    users as never,
    plan as never,
    sessions as never,
    moods as never,
    streak as never,
    mockExams as never,
    vision as never,
    content as never,
    i18n as never,
  );
}

describe("CoachEvidenceService", () => {
  it("builds a PII-minimal deterministic snapshot from verified aggregates", async () => {
    const snapshot = await makeService().build("user-1", now);

    expect(snapshot).toMatchObject({
      examType: "YKS",
      dailyFocusGoalMinutes: 120,
      moodLevel: 2,
      moodTrend: "DOWN",
      planCompletionRate: 33,
      pendingAiCoachPlanTaskId: "00000000-0000-4000-8000-000000000010",
    });
    expect(snapshot.evidence.map((item) => item.type)).toEqual(
      expect.arrayContaining([
        CoachEvidenceType.TODAY_PLAN,
        CoachEvidenceType.RECENT_RHYTHM,
        CoachEvidenceType.LONG_TERM_RHYTHM,
        CoachEvidenceType.MOCK_PERFORMANCE,
        CoachEvidenceType.GOAL,
        CoachEvidenceType.ACTION_OUTCOME,
      ]),
    );
    const serialized = JSON.stringify(snapshot);
    expect(serialized).not.toContain("Ham görev başlığı");
    expect(serialized).not.toContain("hidden@example.com");
    expect(serialized).not.toContain("Aileme söz verdim");
    expect(serialized).not.toContain("Gizli İsim");
    expect(serialized).not.toContain("Bilinmeyen");
    expect(serialized).toContain("Matematik");
    expect(serialized).toContain("SAGLIK");
  });

  it("returns a partial snapshot when an optional evidence source is unavailable", async () => {
    const service = makeService();
    vi.spyOn(service as never, "loadMockEvidence" as never).mockRejectedValue(
      new Error("unavailable"),
    );

    await expect(service.build("user-1", now)).resolves.toBeDefined();
  });

  it("uses honest localized variants when a goal, subject distribution, or time band is absent", async () => {
    const snapshot = await makeService({
      dailyFocusGoalMinutes: null,
      taskSubjects: ["Bilinmeyen"],
      dominantTimeBand: null,
    }).build("user-1", now);

    expect(
      snapshot.evidence.find(
        (item) => item.type === CoachEvidenceType.TODAY_FOCUS,
      )?.summary,
    ).toContain("todayFocusNoGoal");
    expect(
      snapshot.evidence.find(
        (item) => item.type === CoachEvidenceType.TODAY_PLAN,
      )?.summary,
    ).toContain("todayPlanNoSubjects");
    expect(
      snapshot.evidence.find(
        (item) => item.type === CoachEvidenceType.RECENT_RHYTHM,
      )?.summary,
    ).toContain("recentRhythmNoTimeBand");
  });
});
