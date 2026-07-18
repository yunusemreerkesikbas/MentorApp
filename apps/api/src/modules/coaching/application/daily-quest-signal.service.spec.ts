import { describe, expect, it, vi } from "vitest";
import { DailyQuestSignalService } from "./daily-quest-signal.service";

const db = {
  transaction: async <T>(cb: (tx: unknown) => Promise<T>) =>
    cb({ execute: async () => undefined }),
} as never;

function build(options: { goal?: number | null; getMeFails?: boolean } = {}) {
  const planTasks = {
    countDone: vi.fn(async () => 1),
    countDoneAllTime: vi.fn(async () => 25),
    countDoneBetween: vi.fn(async () => 7),
  };
  const sessions = {
    hasCompletedOnDate: vi.fn(async () => true),
    countCompleted: vi.fn(async () => 10),
    countCompletedSince: vi.fn(async () => 3),
    sumCompletedFocusSecondsOnDate: vi.fn(async () => 2730), // 45.5 dk → 46
  };
  const moods = { findByDate: vi.fn(async () => ({ id: "mood-1" })) };
  const dailyActivity = {
    listActiveDatesSince: vi.fn(async () => ["2026-07-13", "2026-07-14"]),
  };
  const users = {
    getMe: options.getMeFails
      ? vi.fn(async () => {
          throw new Error("gone");
        })
      : vi.fn(async () => ({ dailyFocusGoalMinutes: options.goal ?? null })),
  };
  const config = { get: vi.fn(async () => 300) };
  const service = new DailyQuestSignalService(
    db,
    planTasks as never,
    sessions as never,
    moods as never,
    dailyActivity as never,
    users as never,
    config as never,
  );
  return { service, planTasks, sessions, moods, dailyActivity, users, config };
}

describe("DailyQuestSignalService", () => {
  it("returns today's quest signals from coaching repositories", async () => {
    const { service, planTasks, sessions, moods, dailyActivity, config } = build({ goal: 120 });

    const result = await service.getToday("user-1");

    expect(result).toMatchObject({
      hasDonePlanTask: true,
      hasCompletedFocusSession: true,
      hasMoodCheckin: true,
      completedFocusSessions: 10,
      completedPlanTasks: 25,
      focusMinutesToday: 46,
      dailyFocusGoalMinutes: 120,
      weeklyCompletedFocusSessions: 3,
      weeklyCompletedPlanTasks: 7,
      weeklyActiveDays: 2,
    });
    expect(result.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.weekKey).toMatch(/^\d{4}-W\d{2}$/);
    // Weekly windows are bounded by the ISO week's Monday.
    expect(sessions.countCompletedSince).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      300,
    );
    expect(planTasks.countDoneBetween).toHaveBeenCalled();
    expect(dailyActivity.listActiveDatesSince).toHaveBeenCalled();
    expect(config.get).toHaveBeenCalledWith("coaching.session.min_focus_seconds");
    expect(planTasks.countDone).toHaveBeenCalled();
    expect(planTasks.countDoneAllTime).toHaveBeenCalled();
    expect(sessions.hasCompletedOnDate).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      300,
    );
    expect(sessions.countCompleted).toHaveBeenCalledWith(expect.anything(), "user-1", 300);
    expect(sessions.sumCompletedFocusSecondsOnDate).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    );
    expect(moods.findByDate).toHaveBeenCalled();
  });

  it("reports a null goal when the user has none (or the identity read fails)", async () => {
    const { service } = build();
    expect((await service.getToday("user-1")).dailyFocusGoalMinutes).toBeNull();

    const failing = build({ getMeFails: true });
    expect((await failing.service.getToday("user-1")).dailyFocusGoalMinutes).toBeNull();
  });
});
