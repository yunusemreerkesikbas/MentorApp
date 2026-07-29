import { describe, expect, it, vi } from "vitest";
import { addDays, todayIso } from "../domain/date.util";
import { TodayService } from "./today.service";

const USER = "u1";

const i18nFake = { translate: (key: string) => key } as never;

function build(overrides: {
  examType?: string | null;
  calendar?: unknown;
  recapCalendar?: unknown;
  recapStatus?: "EMPTY" | "PARTIAL" | "READY";
  currentStreak?: number;
  mood?: unknown;
  dailyFocusGoalMinutes?: number | null;
  focusMinutesToday?: number;
  focusingNow?: number | null;
  tasks?: unknown[];
}) {
  const users = {
    getMe: vi.fn(async () => ({
      displayName: "Elif",
      examType: overrides.examType === undefined ? "KPSS" : overrides.examType,
      dailyFocusGoalMinutes: overrides.dailyFocusGoalMinutes ?? null,
    })),
  };
  const plan = {
    listForDate: vi.fn(
      async () =>
        overrides.tasks ?? [
          {
            id: "t1",
            title: "Paragraf",
            subject: "Türkçe",
            status: "DONE",
            sortOrder: 0,
            taskDate: todayIso(),
          },
        ],
    ),
  };
  const streak = {
    getSummary: vi.fn(async () => ({
      currentStreak: overrides.currentStreak ?? 7,
      longestStreak: 21,
      freezeTokens: 2,
    })),
  };
  const mood = { getToday: vi.fn(async () => overrides.mood ?? null) };
  const sessions = {
    getTodayFocusMinutes: vi.fn(async () => overrides.focusMinutesToday ?? 0),
    getFocusingNowCount: vi.fn(async () => overrides.focusingNow ?? null),
  };
  const content = {
    getExamCalendar: vi.fn(
      async (examType: string | null, asOf?: string) => {
        if (!examType) return null;
        const defaultCalendar = {
          examId: "exam-1",
          examType: "KPSS",
          examName: "KPSS Lisans 2026",
          examDate: addDays(todayIso(), 30),
          source: "ÖSYM",
          sourceUrl: "https://www.osym.gov.tr",
        };
        if (asOf) {
          return overrides.recapCalendar === undefined
            ? defaultCalendar
            : overrides.recapCalendar;
        }
        return overrides.calendar === undefined
          ? defaultCalendar
          : overrides.calendar;
      },
    ),
  };
  const weeklyReview = {
    getReview: vi.fn(async () => ({
      recap: { status: overrides.recapStatus ?? "READY" },
    })),
  };
  const service = new TodayService(
    users as never,
    plan as never,
    streak as never,
    mood as never,
    sessions as never,
    content as never,
    i18nFake,
    weeklyReview as never,
  );
  return {
    service,
    users,
    plan,
    streak,
    mood,
    sessions,
    content,
    weeklyReview,
  };
}

describe("TodayService — composite panel payload", () => {
  it("assembles the full daily-hub payload (matches the panel mock shape)", async () => {
    const { service } = build({});
    const result = await service.getToday(USER);

    expect(result.greetingName).toBe("Elif");
    expect(result.motivationalLine).toBe("coaching.motivation.GOING"); // streak > 0
    expect(result.countdown).not.toBeNull();
    expect(result.countdown?.examName).toBe("KPSS Lisans 2026");
    expect(result.countdown?.daysRemaining).toBe(30);
    expect(result.streak).toEqual({
      currentStreak: 7,
      longestStreak: 21,
      freezeTokens: 2,
    });
    expect(result.tasks).toHaveLength(1);
    expect(result.sessionPresets.map((p) => p.id)).toEqual(["25_5", "50_10"]);
    expect(result.mood).toBeNull();
    expect(result.weeklyRecapPeriod).toMatchObject({
      examId: "exam-1",
      timeZone: "Europe/Istanbul",
      status: "READY",
    });
    expect(result.weeklyRecapPeriod?.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("surfaces EMPTY so the panel can suppress a misleading teaser", async () => {
    const result = await build({ recapStatus: "EMPTY" }).service.getToday(USER);

    expect(result.weeklyRecapPeriod?.status).toBe("EMPTY");
  });

  it("omits the weekly recap period when the profile has no exam type", async () => {
    const result = await build({ examType: null }).service.getToday(USER);

    expect(result.weeklyRecapPeriod).toBeNull();
  });

  it("uses the START motivational line when the streak is zero", async () => {
    const { service } = build({ currentStreak: 0 });
    const result = await service.getToday(USER);
    expect(result.motivationalLine).toBe("coaching.motivation.START");
  });

  it("returns a null countdown when there is no exam calendar (no silent fallback)", async () => {
    const { service } = build({ calendar: null });
    const result = await service.getToday(USER);
    expect(result.countdown).toBeNull();
  });

  it("keeps the weekly recap available after the countdown exam date has passed", async () => {
    const { service, weeklyReview } = build({
      calendar: null,
      recapCalendar: {
        examId: "recent-exam",
        examType: "KPSS",
        examName: "KPSS Ortaöğretim 2026",
        examDate: addDays(todayIso(), -1),
        source: "ÖSYM",
        sourceUrl: "https://www.osym.gov.tr",
      },
    });

    const result = await service.getToday(USER);

    expect(result.countdown).toBeNull();
    expect(result.weeklyRecapPeriod).toMatchObject({
      examId: "recent-exam",
      status: "READY",
    });
    expect(weeklyReview.getReview).toHaveBeenCalledWith(
      USER,
      "recent-exam",
    );
  });

  it("surfaces the focus goal with today's focus minutes when a goal is set", async () => {
    const { service } = build({
      dailyFocusGoalMinutes: 120,
      focusMinutesToday: 45,
    });
    const result = await service.getToday(USER);
    expect(result.focusGoal).toEqual({
      goalMinutes: 120,
      focusMinutesToday: 45,
    });
  });

  it("surfaces a null goal (no default) when the user never set one", async () => {
    const { service } = build({ focusMinutesToday: 30 });
    const result = await service.getToday(USER);
    expect(result.focusGoal).toEqual({
      goalMinutes: null,
      focusMinutesToday: 30,
    });
  });

  it("passes the focusing-now ambience count through (null below threshold)", async () => {
    expect(
      (await build({ focusingNow: 12 }).service.getToday(USER)).focusingNow,
    ).toBe(12);
    expect((await build({}).service.getToday(USER)).focusingNow).toBeNull();
  });

  it("degrades focusingNow to null when the aggregate read fails (hub stays up)", async () => {
    const { service, sessions } = build({});
    sessions.getFocusingNowCount.mockRejectedValue(new Error("db hiccup"));
    const result = await service.getToday(USER);
    expect(result.focusingNow).toBeNull();
    expect(result.greetingName).toBe("Elif");
  });

  it("selects the first pending task as today's next action", async () => {
    const tasks = [
      {
        id: "done",
        title: "Done",
        subject: null,
        status: "DONE",
        sortOrder: 0,
        taskDate: todayIso(),
      },
      {
        id: "first",
        title: "Reading",
        subject: "Language",
        status: "PENDING",
        sortOrder: 1,
        taskDate: todayIso(),
      },
      {
        id: "later",
        title: "History",
        subject: "History",
        status: "PENDING",
        sortOrder: 2,
        taskDate: todayIso(),
      },
    ];

    await expect(
      build({ tasks }).service.getToday(USER),
    ).resolves.toMatchObject({
      nextAction: {
        kind: "START_TASK",
        title: "coaching.nextAction.START_TASK.title",
        message: "coaching.nextAction.START_TASK.message",
        taskId: "first",
      },
    });
  });

  it("keeps the pending task but uses gentler copy when mood is low", async () => {
    const tasks = [
      {
        id: "first",
        title: "Reading",
        subject: "Language",
        status: "PENDING",
        sortOrder: 0,
        taskDate: todayIso(),
      },
    ];

    await expect(
      build({ tasks, mood: { mood: 2 } }).service.getToday(USER),
    ).resolves.toMatchObject({
      nextAction: {
        kind: "START_TASK",
        message: "coaching.nextAction.START_TASK.lowMoodMessage",
        taskId: "first",
      },
    });
  });

  it("asks the user to add one task when today's plan is empty", async () => {
    await expect(
      build({ tasks: [] }).service.getToday(USER),
    ).resolves.toMatchObject({
      nextAction: {
        kind: "ADD_TASK",
        title: "coaching.nextAction.ADD_TASK.title",
        message: "coaching.nextAction.ADD_TASK.message",
        taskId: null,
      },
    });
  });

  it("celebrates calmly without a CTA when every task is complete", async () => {
    await expect(build({}).service.getToday(USER)).resolves.toMatchObject({
      nextAction: {
        kind: "DAY_COMPLETE",
        title: "coaching.nextAction.DAY_COMPLETE.title",
        message: "coaching.nextAction.DAY_COMPLETE.message",
        taskId: null,
      },
    });
  });
});
