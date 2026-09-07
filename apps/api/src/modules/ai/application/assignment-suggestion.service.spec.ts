import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MentorshipStudentReportDto } from "@mentor/types";
import { AssignmentSuggestionService } from "./assignment-suggestion.service";

const COACH = { id: "coach-1", roles: ["COACH"] };

const REPORT = {
  studentId: "student-a",
  studentDisplayName: "Zeynep Kaya",
  studentUsername: "zeynep",
  acceptedAt: "2026-08-01T00:00:00.000Z",
  studentExamType: "KPSS",
  coachNote: { body: "Bu öğrenciyi sıkıştırma.", updatedAt: "2026-09-01T00:00:00.000Z" },
  riskFlags: ["INACTIVE"],
  attendedAt: null,
  needsAttention: true,
  activity: {
    lastActiveDate: "2026-09-01",
    currentStreak: 0,
    longestStreak: 4,
    sessions7d: 0,
    focusMinutes7d: 0,
    activeDays7d: 0,
    sessions28d: 3,
    focusMinutes28d: 90,
    activeDays28d: 3,
  },
  planCompletionRate7d: 0.2,
  mockTrend: [],
  latestMockSubjects: [],
  moodTrend: [],
  planTasks: [],
  droppedAssignments: [],
} as unknown as MentorshipStudentReportDto;

describe("AssignmentSuggestionService", () => {
  let complete: ReturnType<typeof vi.fn>;
  let append: ReturnType<typeof vi.fn>;
  let assertAllowed: ReturnType<typeof vi.fn>;
  let assertWithinBudget: ReturnType<typeof vi.fn>;
  let service: AssignmentSuggestionService;

  beforeEach(() => {
    complete = vi.fn(async () => ({
      text: JSON.stringify({
        tasks: [{ dayIndex: 0, title: "Paragraf: 20 soru", subject: "Türkçe" }],
      }),
      model: "fake",
      promptTokens: 10,
      completionTokens: 5,
    }));
    append = vi.fn(async () => undefined);
    assertAllowed = vi.fn(async () => undefined);
    assertWithinBudget = vi.fn(async () => undefined);
    service = new AssignmentSuggestionService(
      { complete } as never,
      { get: vi.fn(async () => true) } as never,
      { append } as never,
      { assertWithinBudget } as never,
      { assertAllowed } as never,
    );
  });

  it("blanks a subject this student's data never named", async () => {
    // REPORT carries no mock subjects and no plan tasks, so "Türkçe" is the model assuming a
    // syllabus. The task survives — the title is prose the coach edits — but the structured claim
    // does not, because it would ride into `plan_tasks.subject` and be grouped and counted later.
    const result = await service.suggest(REPORT, COACH, "tr");
    expect(result.tasks).toEqual([
      {
        dayIndex: 0,
        title: "Paragraf: 20 soru",
        subject: null,
        topic: null,
        coachNote: null,
      },
    ]);
    expect(result.model).toBe("fake");
  });

  it("keeps a subject the student's own plan already names", async () => {
    const grounded = {
      ...REPORT,
      planTasks: [
        {
          taskDate: "2026-09-02",
          title: "Paragraf",
          subject: "Türkçe",
          status: "PENDING",
          assignedByCoach: false,
        },
      ],
    } as unknown as MentorshipStudentReportDto;
    const result = await service.suggest(grounded, COACH, "tr");
    expect(result.tasks[0]!.subject).toBe("Türkçe");
  });

  it("charges the COACH, never the student", async () => {
    await service.suggest(REPORT, COACH, "tr");
    expect(assertAllowed).toHaveBeenCalledWith(
      COACH.id,
      COACH.roles,
      "mentorship.suggestions",
    );
    expect(append.mock.calls[0]![0]).toMatchObject({
      userId: COACH.id,
      feature: "mentorship_suggestions",
    });
  });

  it("refuses before spending anything when the coach has no entitlement", async () => {
    assertAllowed.mockRejectedValueOnce(new Error("PAYMENT_PREMIUM_REQUIRED"));
    await expect(service.suggest(REPORT, COACH, "tr")).rejects.toThrow(
      "PAYMENT_PREMIUM_REQUIRED",
    );
    expect(assertWithinBudget).not.toHaveBeenCalled();
    expect(complete).not.toHaveBeenCalled();
  });

  it("sends neither the student's name nor the coach's own note to the model", async () => {
    await service.suggest(REPORT, COACH, "tr");
    const prompt = complete.mock.calls[0]![0] as { system: string; user: string };
    // The evidence shaper is the brief's, so both exclusions are inherited rather than repeated.
    expect(prompt.user).not.toContain("Zeynep");
    expect(prompt.user).not.toContain("sıkıştırma");
    expect(prompt.user).not.toContain("student-a");
  });

  it("turns an unparseable answer into a provider error, after metering the call", async () => {
    complete.mockResolvedValueOnce({
      text: "bugün canım istemedi",
      model: "fake",
      promptTokens: 3,
      completionTokens: 2,
    });
    await expect(service.suggest(REPORT, COACH, "tr")).rejects.toMatchObject({
      code: "AI_PROVIDER_ERROR",
    });
    // The tokens were spent whether or not the answer was usable; a meter that only counts
    // successes under-reports the bill.
    expect(append).toHaveBeenCalledTimes(1);
  });
});
