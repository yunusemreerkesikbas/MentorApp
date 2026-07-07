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
  signals?: {
    hasDonePlanTask?: boolean;
    hasCompletedFocusSession?: boolean;
    hasMoodCheckin?: boolean;
  };
  user?: { examType: string | null; emailVerified: boolean };
  subscription?: unknown;
  redeemed?: unknown;
  rows?: ProgressRow[];
  grantShouldFail?: boolean;
} = {}) {
  const rows = options.rows ?? [];
  const date = options.date ?? "2026-07-06";
  const config = {
    get: vi.fn(async (key: string) => {
      if (key === "economy.enabled") return options.economyEnabled ?? true;
      if (key === "economy.quest.onboarding_reward_coin") return 10;
      if (key === "economy.quest.daily_ritual_reward_xp") return 5;
      return 0;
    }),
  };
  const dailySignals = {
    getToday: vi.fn(async () => ({
      date,
      hasDonePlanTask: options.signals?.hasDonePlanTask ?? false,
      hasCompletedFocusSession: options.signals?.hasCompletedFocusSession ?? false,
      hasMoodCheckin: options.signals?.hasMoodCheckin ?? false,
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
      { findRedemptionByInvited: vi.fn(async () => options.redeemed ?? null) } as never,
      economy as never,
      quests as never,
      config as never,
    ),
  };
}

describe("QuestService", () => {
  it("returns daily ritual and onboarding quests with their reward metadata", async () => {
    const quests = await service().service.getUserProgress("user-1");

    expect(quests).toHaveLength(7);
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
    expect(quests[3]).toMatchObject({
      id: "onboarding.profile-setup",
      category: "onboarding",
      periodKey: "once",
      rewardUnit: "COIN",
      rewardAmount: 10,
      rewardCoin: 10,
    });
  });

  it("grants a daily ritual XP quest only once per day", async () => {
    const subject = service({ signals: { hasDonePlanTask: true } });

    await subject.service.evaluateAndGrant("user-1");
    await subject.service.evaluateAndGrant("user-1");

    expect(subject.quests.listForUser).toHaveBeenNthCalledWith(1, "user-1", ["once", "2026-07-06"]);
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
