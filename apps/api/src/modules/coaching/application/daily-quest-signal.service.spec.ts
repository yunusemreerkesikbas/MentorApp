import { describe, expect, it, vi } from "vitest";
import { DailyQuestSignalService } from "./daily-quest-signal.service";

describe("DailyQuestSignalService", () => {
  it("returns today's quest signals from coaching repositories", async () => {
    const db = {
      transaction: async <T>(cb: (tx: unknown) => Promise<T>) =>
        cb({ execute: async () => undefined }),
    } as never;
    const planTasks = {
      countDone: vi.fn(async () => 1),
      countDoneAllTime: vi.fn(async () => 25),
    };
    const sessions = {
      hasCompletedOnDate: vi.fn(async () => true),
      countCompleted: vi.fn(async () => 10),
    };
    const moods = { findByDate: vi.fn(async () => ({ id: "mood-1" })) };
    const service = new DailyQuestSignalService(
      db,
      planTasks as never,
      sessions as never,
      moods as never,
    );

    const result = await service.getToday("user-1");

    expect(result).toMatchObject({
      hasDonePlanTask: true,
      hasCompletedFocusSession: true,
      hasMoodCheckin: true,
      completedFocusSessions: 10,
      completedPlanTasks: 25,
    });
    expect(result.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(planTasks.countDone).toHaveBeenCalled();
    expect(planTasks.countDoneAllTime).toHaveBeenCalled();
    expect(sessions.hasCompletedOnDate).toHaveBeenCalled();
    expect(sessions.countCompleted).toHaveBeenCalled();
    expect(moods.findByDate).toHaveBeenCalled();
  });
});
