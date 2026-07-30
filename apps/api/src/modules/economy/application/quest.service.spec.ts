import { describe, expect, it, vi } from "vitest";
import { Logger } from "@nestjs/common";
import { Currency } from "@mentor/types";
import { QuestService } from "./quest.service";

interface ProgressRow {
  id: string;
  questId: string;
  periodKey: string;
  completedAt: Date;
}

function service(options: {
  economyEnabled?: boolean;
  date?: string;
  weekKey?: string;
  disabledIds?: string;
  weeklyAllowanceRewardCoin?: number;
  signals?: {
    hasDonePlanTask?: boolean;
    hasCompletedFocusSession?: boolean;
    hasMoodCheckin?: boolean;
    completedFocusSessions?: number;
    completedPlanTasks?: number;
    focusMinutesToday?: number;
    dailyFocusGoalMinutes?: number | null;
    weeklyCompletedFocusSessions?: number;
    weeklyCompletedPlanTasks?: number;
    weeklyActiveDays?: number;
  };
  user?: { examType: string | null; emailVerified: boolean };
  subscription?: unknown;
  redeemed?: unknown;
  currentStreak?: number;
  rows?: ProgressRow[];
  grantShouldFail?: boolean;
} = {}) {
  const rows = options.rows ?? [];
  const date = options.date ?? "2026-07-06";
  const weekKey = options.weekKey ?? "2026-W28";
  const config = {
    get: vi.fn(async (key: string) => {
      if (key === "economy.enabled") return options.economyEnabled ?? true;
      if (key === "economy.quest.onboarding_reward_coin") return 10;
      if (key === "economy.quest.daily_ritual_reward_xp") return 5;
      if (key === "economy.quest.streak_milestone_reward_xp") return 25;
      if (key === "economy.quest.effort_milestone_reward_xp") return 25;
      if (key === "economy.quest.weekly_ritual_reward_xp") return 20;
      if (key === "economy.quest.weekly_allowance_reward_coin")
        return options.weeklyAllowanceRewardCoin ?? 15;
      if (key === "economy.quest.weekly_focus_sessions_target") return 5;
      if (key === "economy.quest.weekly_plan_tasks_target") return 10;
      if (key === "economy.quest.weekly_allowance_active_days_target") return 5;
      if (key === "economy.quest.disabled_ids") return options.disabledIds ?? "";
      return 0;
    }),
  };
  const dailySignals = {
    getToday: vi.fn(async () => ({
      date,
      hasDonePlanTask: options.signals?.hasDonePlanTask ?? false,
      hasCompletedFocusSession: options.signals?.hasCompletedFocusSession ?? false,
      hasMoodCheckin: options.signals?.hasMoodCheckin ?? false,
      completedFocusSessions: options.signals?.completedFocusSessions ?? 0,
      completedPlanTasks: options.signals?.completedPlanTasks ?? 0,
      focusMinutesToday: options.signals?.focusMinutesToday ?? 0,
      dailyFocusGoalMinutes: options.signals?.dailyFocusGoalMinutes ?? null,
      weekKey,
      weeklyCompletedFocusSessions: options.signals?.weeklyCompletedFocusSessions ?? 0,
      weeklyCompletedPlanTasks: options.signals?.weeklyCompletedPlanTasks ?? 0,
      weeklyActiveDays: options.signals?.weeklyActiveDays ?? 0,
    })),
  };
  const streak = {
    getSummary: vi.fn(async () => ({
      currentStreak: options.currentStreak ?? 0,
      longestStreak: options.currentStreak ?? 0,
      freezeTokens: 0,
    })),
  };
  const quests = {
    withServiceTx: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
      const snapshot = [...rows];
      try {
        return await fn({});
      } catch (err) {
        rows.length = 0;
        rows.push(...snapshot);
        throw err;
      }
    }),
    listForUser: vi.fn(async (_userId: string, periodKeys?: readonly string[]) =>
      periodKeys ? rows.filter((row) => periodKeys.includes(row.periodKey)) : rows,
    ),
    markCompleted: vi.fn(async (_userId: string, questId: string, periodKey: string) => {
      if (rows.some((row) => row.questId === questId && row.periodKey === periodKey)) {
        return undefined;
      }
      const row = {
        id: `${questId}:${periodKey}`,
        questId,
        periodKey,
        completedAt: new Date(`${date}T10:00:00.000Z`),
      };
      rows.push(row);
      return row;
    }),
  };
  const economy = {
    grant: vi.fn(async () => undefined),
    grantInServiceTx: vi.fn(async () => {
      if (options.grantShouldFail) throw new Error("grant failed");
    }),
  };

  return {
    economy,
    quests,
    rows,
    service: new QuestService(
      { getMe: vi.fn(async () => options.user ?? { examType: null, emailVerified: false }) } as never,
      { getView: vi.fn(async () => ({ subscription: options.subscription ?? null })) } as never,
      dailySignals as never,
      streak as never,
      { findRedemptionByInvited: vi.fn(async () => options.redeemed ?? null) } as never,
      economy as never,
      quests as never,
      config as never,
    ),
    streak,
  };
}

describe("QuestService — daily.focus-goal-met", () => {
  it("is hidden from views when the user has no goal set", async () => {
    const quests = await service().service.getUserProgress("user-1");
    expect(quests.find((q) => q.id === "daily.focus-goal-met")).toBeUndefined();
  });

  it("is visible with daily XP reward when a goal is set", async () => {
    const quests = await service({
      signals: { dailyFocusGoalMinutes: 120, focusMinutesToday: 30 },
    }).service.getUserProgress("user-1");
    const quest = quests.find((q) => q.id === "daily.focus-goal-met");
    expect(quest).toMatchObject({
      rewardUnit: "XP",
      rewardAmount: 5,
      completed: false,
    });
  });

  it("grants XP once when today's focus minutes reach the goal", async () => {
    const subject = service({
      signals: { dailyFocusGoalMinutes: 120, focusMinutesToday: 125 },
    });
    await subject.service.evaluateAndGrant("user-1");

    expect(
      subject.rows.some((row) => row.questId === "daily.focus-goal-met"),
    ).toBe(true);
    expect(subject.economy.grantInServiceTx).toHaveBeenCalledWith(
      "user-1",
      Currency.XP,
      5,
      expect.objectContaining({ reason: "quest.daily.focus-goal-met" }),
      expect.anything(),
    );

    // Second evaluation on the same day is idempotent.
    subject.economy.grantInServiceTx.mockClear();
    await subject.service.evaluateAndGrant("user-1");
    expect(subject.economy.grantInServiceTx).not.toHaveBeenCalledWith(
      "user-1",
      Currency.XP,
      5,
      expect.objectContaining({ reason: "quest.daily.focus-goal-met" }),
      expect.anything(),
    );
  });

  it("does not grant when focus minutes are below the goal", async () => {
    const subject = service({
      signals: { dailyFocusGoalMinutes: 120, focusMinutesToday: 119 },
    });
    await subject.service.evaluateAndGrant("user-1");
    expect(
      subject.rows.some((row) => row.questId === "daily.focus-goal-met"),
    ).toBe(false);
  });
});

describe("QuestService", () => {
  it("returns daily ritual and onboarding quests with their reward metadata", async () => {
    const quests = await service().service.getUserProgress("user-1");

    expect(quests).toHaveLength(24);
    expect(quests[0]).toMatchObject({
      id: "daily.plan-task-done",
      category: "daily_ritual",
      period: "daily",
      periodKey: "2026-07-06",
      rewardUnit: "XP",
      rewardAmount: 5,
      rewardCoin: 0,
      action: "plan",
    });
    expect(quests.find((quest) => quest.id === "onboarding.profile-setup")).toMatchObject({
      id: "onboarding.profile-setup",
      category: "onboarding",
      periodKey: "once",
      rewardUnit: "COIN",
      rewardAmount: 10,
      rewardCoin: 10,
    });
  });

  it("returns streak milestone quests with progress metadata", async () => {
    const quests = await service({ currentStreak: 3 }).service.getUserProgress("user-1");

    const firstMilestone = quests.find((quest) => quest.id === "milestone.streak.7");
    expect(firstMilestone).toMatchObject({
      category: "milestone",
      period: "once",
      periodKey: "once",
      rewardUnit: "XP",
      rewardAmount: 25,
      rewardCoin: 0,
      action: "panel",
      progressCurrent: 3,
      progressTarget: 7,
    });
  });

  it("returns effort milestone quests with progress metadata", async () => {
    const quests = await service({
      signals: { completedFocusSessions: 3, completedPlanTasks: 12 },
    }).service.getUserProgress("user-1");

    expect(quests.find((quest) => quest.id === "milestone.focus_sessions.10")).toMatchObject({
      category: "milestone",
      period: "once",
      periodKey: "once",
      rewardUnit: "XP",
      rewardAmount: 25,
      rewardCoin: 0,
      action: "study-session",
      progressCurrent: 3,
      progressTarget: 10,
    });
    expect(quests.find((quest) => quest.id === "milestone.plan_tasks.25")).toMatchObject({
      action: "plan",
      progressCurrent: 12,
      progressTarget: 25,
    });
  });

  it("keeps completed milestone progress at the target after a streak reset", async () => {
    const quests = await service({
      currentStreak: 0,
      rows: [
        {
          id: "progress-1",
          questId: "milestone.streak.7",
          periodKey: "once",
          completedAt: new Date("2026-07-01T00:00:00.000Z"),
        },
      ],
    }).service.getUserProgress("user-1");

    expect(quests.find((quest) => quest.id === "milestone.streak.7")).toMatchObject({
      completed: true,
      progressCurrent: 7,
      progressTarget: 7,
    });
  });

  it("does not grant a streak milestone before the target is reached", async () => {
    const subject = service({ currentStreak: 6 });

    await subject.service.evaluateAndGrant("user-1");

    expect(subject.quests.markCompleted).not.toHaveBeenCalled();
    expect(subject.economy.grantInServiceTx).not.toHaveBeenCalled();
  });

  it("grants reached streak milestone XP once", async () => {
    const subject = service({ currentStreak: 7 });

    await subject.service.evaluateAndGrant("user-1");
    await subject.service.evaluateAndGrant("user-1");

    expect(subject.quests.markCompleted).toHaveBeenCalledTimes(1);
    expect(subject.economy.grantInServiceTx).toHaveBeenCalledTimes(1);
    expect(subject.economy.grantInServiceTx).toHaveBeenCalledWith(
      "user-1",
      Currency.XP,
      25,
      expect.objectContaining({
        reason: "quest.milestone.streak.7",
        refType: "quest",
      }),
      {},
    );
  });

  it("grants each reached streak milestone once when multiple thresholds are met", async () => {
    const subject = service({ currentStreak: 14 });

    await subject.service.evaluateAndGrant("user-1");

    expect(subject.quests.markCompleted).toHaveBeenCalledTimes(2);
    expect(subject.economy.grantInServiceTx).toHaveBeenCalledWith(
      "user-1",
      Currency.XP,
      25,
      expect.objectContaining({ reason: "quest.milestone.streak.7" }),
      {},
    );
    expect(subject.economy.grantInServiceTx).toHaveBeenCalledWith(
      "user-1",
      Currency.XP,
      25,
      expect.objectContaining({ reason: "quest.milestone.streak.14" }),
      {},
    );
  });

  it("does not grant an effort milestone before the target is reached", async () => {
    const subject = service({ signals: { completedFocusSessions: 9, completedPlanTasks: 24 } });

    await subject.service.evaluateAndGrant("user-1");

    expect(subject.quests.markCompleted).not.toHaveBeenCalled();
    expect(subject.economy.grantInServiceTx).not.toHaveBeenCalled();
  });

  it("grants reached effort milestone XP once", async () => {
    const subject = service({ signals: { completedFocusSessions: 10 } });

    await subject.service.evaluateAndGrant("user-1");
    await subject.service.evaluateAndGrant("user-1");

    expect(subject.quests.markCompleted).toHaveBeenCalledTimes(1);
    expect(subject.economy.grantInServiceTx).toHaveBeenCalledTimes(1);
    expect(subject.economy.grantInServiceTx).toHaveBeenCalledWith(
      "user-1",
      Currency.XP,
      25,
      expect.objectContaining({
        reason: "quest.milestone.focus_sessions.10",
        refType: "quest",
      }),
      {},
    );
  });

  it("grants each reached effort milestone once when multiple thresholds are met", async () => {
    const subject = service({ signals: { completedFocusSessions: 25, completedPlanTasks: 50 } });

    await subject.service.evaluateAndGrant("user-1");

    expect(subject.quests.markCompleted).toHaveBeenCalledTimes(4);
    expect(subject.economy.grantInServiceTx).toHaveBeenCalledWith(
      "user-1",
      Currency.XP,
      25,
      expect.objectContaining({ reason: "quest.milestone.focus_sessions.10" }),
      {},
    );
    expect(subject.economy.grantInServiceTx).toHaveBeenCalledWith(
      "user-1",
      Currency.XP,
      25,
      expect.objectContaining({ reason: "quest.milestone.focus_sessions.25" }),
      {},
    );
    expect(subject.economy.grantInServiceTx).toHaveBeenCalledWith(
      "user-1",
      Currency.XP,
      25,
      expect.objectContaining({ reason: "quest.milestone.plan_tasks.25" }),
      {},
    );
    expect(subject.economy.grantInServiceTx).toHaveBeenCalledWith(
      "user-1",
      Currency.XP,
      25,
      expect.objectContaining({ reason: "quest.milestone.plan_tasks.50" }),
      {},
    );
  });

  it("grants a daily ritual XP quest only once per day", async () => {
    const subject = service({ signals: { hasDonePlanTask: true } });

    await subject.service.evaluateAndGrant("user-1");
    await subject.service.evaluateAndGrant("user-1");

    expect(subject.quests.listForUser).toHaveBeenNthCalledWith(1, "user-1", [
      "once",
      "2026-07-06",
      "2026-W28",
    ]);
    expect(subject.quests.markCompleted).toHaveBeenCalledTimes(1);
    expect(subject.economy.grantInServiceTx).toHaveBeenCalledTimes(1);
    expect(subject.economy.grantInServiceTx).toHaveBeenCalledWith(
      "user-1",
      Currency.XP,
      5,
      expect.objectContaining({
        reason: "quest.daily.plan-task-done",
        refType: "quest",
      }),
      {},
    );
  });

  it("grants the same daily ritual quest again on the next day", async () => {
    const rows: ProgressRow[] = [];
    await service({
      date: "2026-07-06",
      signals: { hasDonePlanTask: true },
      rows,
    }).service.evaluateAndGrant("user-1");
    const dayTwo = service({
      date: "2026-07-07",
      signals: { hasDonePlanTask: true },
      rows,
    });

    await dayTwo.service.evaluateAndGrant("user-1");

    expect(rows.filter((row) => row.questId === "daily.plan-task-done")).toHaveLength(2);
    expect(dayTwo.economy.grantInServiceTx).toHaveBeenCalledWith(
      "user-1",
      Currency.XP,
      5,
      expect.objectContaining({ reason: "quest.daily.plan-task-done" }),
      {},
    );
  });

  it("keeps onboarding quests one-shot and Coin-based", async () => {
    const subject = service({ user: { examType: "KPSS", emailVerified: false } });

    await subject.service.evaluateAndGrant("user-1");
    await subject.service.evaluateAndGrant("user-1");

    expect(subject.economy.grantInServiceTx).toHaveBeenCalledTimes(1);
    expect(subject.economy.grantInServiceTx).toHaveBeenCalledWith(
      "user-1",
      Currency.COIN,
      10,
      expect.objectContaining({
        reason: "quest.onboarding.profile-setup",
        refType: "quest",
      }),
      {},
    );
  });

  it("does not leave a completed progress row when reward grant fails", async () => {
    const subject = service({
      grantShouldFail: true,
      signals: { hasDonePlanTask: true },
    });
    const errorSpy = vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);

    try {
      await subject.service.evaluateAndGrant("user-1");
    } finally {
      errorSpy.mockRestore();
    }

    expect(subject.economy.grantInServiceTx).toHaveBeenCalledTimes(1);
    expect(subject.rows).toHaveLength(0);
  });

  it("does not evaluate or grant quests while economy is disabled", async () => {
    const subject = service({
      economyEnabled: false,
      signals: { hasDonePlanTask: true },
      user: { examType: "KPSS", emailVerified: true },
    });

    await subject.service.evaluateAndGrant("user-1");

    expect(subject.quests.listForUser).not.toHaveBeenCalled();
    expect(subject.economy.grantInServiceTx).not.toHaveBeenCalled();
  });
});

describe("QuestService — weekly quests (v3)", () => {
  it("grants weekly XP once per ISO week, keyed on the week period", async () => {
    const subject = service({ signals: { weeklyCompletedFocusSessions: 5 } });
    await subject.service.evaluateAndGrant("user-1");
    expect(subject.economy.grantInServiceTx).toHaveBeenCalledWith(
      "user-1",
      Currency.XP,
      20,
      expect.objectContaining({ reason: "quest.weekly.focus-sessions" }),
      {},
    );
    expect(subject.rows).toContainEqual(
      expect.objectContaining({ questId: "weekly.focus-sessions", periodKey: "2026-W28" }),
    );

    // Same week again → no double grant.
    subject.economy.grantInServiceTx.mockClear();
    await subject.service.evaluateAndGrant("user-1");
    expect(subject.economy.grantInServiceTx).not.toHaveBeenCalled();
  });

  it("is re-grantable in the next ISO week (fresh period key)", async () => {
    const rows: ProgressRow[] = [
      {
        id: "weekly.focus-sessions:2026-W27",
        questId: "weekly.focus-sessions",
        periodKey: "2026-W27",
        completedAt: new Date("2026-07-05T10:00:00.000Z"),
      },
    ];
    const subject = service({ rows, signals: { weeklyCompletedFocusSessions: 5 } });
    await subject.service.evaluateAndGrant("user-1");
    expect(subject.rows).toContainEqual(
      expect.objectContaining({ questId: "weekly.focus-sessions", periodKey: "2026-W28" }),
    );
  });

  it("does not grant below the config-driven target and resolves {target} in the view title", async () => {
    const subject = service({ signals: { weeklyCompletedFocusSessions: 4 } });
    const views = await subject.service.getUserProgress("user-1");
    expect(subject.economy.grantInServiceTx).not.toHaveBeenCalled();
    const quest = views.find((q) => q.id === "weekly.focus-sessions");
    expect(quest).toMatchObject({
      title: "Bu hafta 5 odak seansı tamamla",
      progressCurrent: 4,
      progressTarget: 5,
      rewardUnit: "XP",
      rewardAmount: 20,
      periodKey: "2026-W28",
      completed: false,
    });
  });

  it("weekly.streak-full-week requires all 7 active days", async () => {
    const six = service({ signals: { weeklyActiveDays: 6 } });
    await six.service.evaluateAndGrant("user-1");
    expect(six.rows.find((r) => r.questId === "weekly.streak-full-week")).toBeUndefined();

    const seven = service({ signals: { weeklyActiveDays: 7 } });
    await seven.service.evaluateAndGrant("user-1");
    expect(seven.rows).toContainEqual(
      expect.objectContaining({ questId: "weekly.streak-full-week", periodKey: "2026-W28" }),
    );
  });

  it("a disabled quest id is neither listed nor granted (kill-switch)", async () => {
    const subject = service({
      disabledIds: "weekly.focus-sessions, daily.plan-task-done",
      signals: { weeklyCompletedFocusSessions: 5, hasDonePlanTask: true },
    });
    const views = await subject.service.getUserProgress("user-1");
    expect(views.find((q) => q.id === "weekly.focus-sessions")).toBeUndefined();
    expect(views.find((q) => q.id === "daily.plan-task-done")).toBeUndefined();
    expect(subject.rows).toHaveLength(0);
  });
});

describe("QuestService — weekly.effort-allowance (recurring coin faucet)", () => {
  it("pays the weekly allowance amount, NOT the onboarding coin amount", async () => {
    const subject = service({ signals: { weeklyActiveDays: 5 } });

    await subject.service.evaluateAndGrant("user-1");

    // Regression guard: without a coinReward() resolver every COIN quest silently paid 10.
    expect(subject.economy.grantInServiceTx).toHaveBeenCalledWith(
      "user-1",
      Currency.COIN,
      15,
      expect.objectContaining({ reason: "quest.weekly.effort-allowance", refType: "quest" }),
      {},
    );
  });

  it("does not grant below the active-day target and renders the resolved title", async () => {
    const subject = service({ signals: { weeklyActiveDays: 4 } });

    const views = await subject.service.getUserProgress("user-1");

    expect(
      subject.economy.grantInServiceTx.mock.calls.filter(
        (call) => (call[3] as { reason: string }).reason === "quest.weekly.effort-allowance",
      ),
    ).toHaveLength(0);
    expect(views.find((q) => q.id === "weekly.effort-allowance")).toMatchObject({
      title: "Bu hafta 5 gün aktif ol",
      progressCurrent: 4,
      progressTarget: 5,
      rewardUnit: "COIN",
      rewardAmount: 15,
      periodKey: "2026-W28",
      completed: false,
    });
  });

  it("grants once per ISO week and re-arms the next week", async () => {
    const rows: ProgressRow[] = [];
    const week28 = service({ rows, signals: { weeklyActiveDays: 5 } });
    await week28.service.evaluateAndGrant("user-1");
    await week28.service.evaluateAndGrant("user-1");
    expect(
      rows.filter((r) => r.questId === "weekly.effort-allowance"),
    ).toHaveLength(1);

    const week29 = service({ rows, weekKey: "2026-W29", signals: { weeklyActiveDays: 5 } });
    await week29.service.evaluateAndGrant("user-1");
    expect(rows).toContainEqual(
      expect.objectContaining({ questId: "weekly.effort-allowance", periodKey: "2026-W29" }),
    );
  });

  it("is killable without a deploy via disabled_ids", async () => {
    const subject = service({
      disabledIds: "weekly.effort-allowance",
      signals: { weeklyActiveDays: 7 },
    });

    const views = await subject.service.getUserProgress("user-1");

    expect(views.find((q) => q.id === "weekly.effort-allowance")).toBeUndefined();
    expect(subject.rows.find((r) => r.questId === "weekly.effort-allowance")).toBeUndefined();
  });
});
