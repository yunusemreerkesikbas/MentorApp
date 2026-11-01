import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import trEconomy from "../../../i18n/locales/tr/economy.json";
import { WeeklyChestService } from "./weekly-chest.service";

// Wednesday 2026-11-04 (UTC) → this week 2026-W45 (Mon 11-02), last week 2026-W44 (Sun 11-01).
const NOW = new Date("2026-11-04T10:00:00Z");

interface Row {
  id: string;
  questId: string;
  periodKey: string;
  revealedAt: Date | null;
}

const chestRow = (periodKey: string, revealed = false): Row => ({
  id: `row-${periodKey}`,
  questId: "weekly.effort-allowance",
  periodKey,
  revealedAt: revealed ? new Date("2026-11-03T08:00:00Z") : null,
});

function build(options: { economyEnabled?: boolean; disabledIds?: string; rows?: Row[]; pending?: string[] } = {}) {
  const rows = options.rows ?? [];
  const quests = { evaluateAndGrant: vi.fn(async (_userId: string, _date?: string) => options.pending ?? []) };
  const weeks: Record<string, { weekKey: string; dates: string[] }> = {
    "2026-11-04": { weekKey: "2026-W45", dates: ["2026-11-02", "2026-11-04"] },
    "2026-11-01": {
      weekKey: "2026-W44",
      dates: ["2026-10-26", "2026-10-27", "2026-10-28", "2026-10-30", "2026-11-01"],
    },
  };
  const signals = {
    getForDate: vi.fn(async (_userId: string, date: string) => ({
      date,
      weekKey: weeks[date]!.weekKey,
      weeklyActiveDates: weeks[date]!.dates,
      weeklyActiveDays: weeks[date]!.dates.length,
      weeklyCompletedFocusSessions: 4,
      weeklyCompletedPlanTasks: 6,
      weeklyFocusMinutes: 200,
    })),
  };
  const progress = {
    listForUser: vi.fn(async (_userId: string, keys: string[]) => rows.filter((r) => keys.includes(r.periodKey))),
    markRevealed: vi.fn(async () => undefined),
  };
  const ledger = { findByRef: vi.fn(async (_type: string, refId: string) => ({ id: `ledger-${refId}`, amount: 15 })) };
  const receipts = { markSeen: vi.fn(async () => undefined) };
  const config = {
    get: vi.fn(async (key: string) => {
      if (key === "economy.enabled") return options.economyEnabled ?? true;
      if (key === "economy.quest.weekly_allowance_active_days_target") return 5;
      if (key === "economy.quest.weekly_allowance_reward_coin") return 15;
      if (key === "economy.quest.disabled_ids") return options.disabledIds ?? "";
      return 0;
    }),
  };
  const i18n = {
    translate: vi.fn((key: string) => (trEconomy as Record<string, string>)[key.replace(/^economy\./, "")] ?? key),
  };
  const service = new WeeklyChestService(
    quests as never,
    signals as never,
    progress as never,
    ledger as never,
    receipts as never,
    config as never,
    i18n as never,
  );
  return { service, quests, signals, progress, ledger, receipts };
}

const notFound = (err: unknown) => err instanceof DomainError && err.code === ErrorCode.WEEKLY_CHEST_NOT_FOUND;

describe("WeeklyChestService", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  it("shows this week's progress with the Coin it will grant, without the note", async () => {
    const { service, quests, progress } = build();
    const view = await service.getView("user-1");
    expect(view).toMatchObject({
      state: "PROGRESS",
      periodKey: "2026-W45",
      carriedOver: false,
      current: 2,
      target: 5,
      today: "2026-11-04",
      reward: { unit: "COIN", amount: 15 },
    });
    expect(view.summary).toBeUndefined();
    expect(view.days).toHaveLength(7);
    expect(view.days[0]).toEqual({ date: "2026-11-02", active: true });
    expect(view.days[1]).toEqual({ date: "2026-11-03", active: false });
    expect(view.days[6]).toEqual({ date: "2026-11-08", active: false });
    expect(quests.evaluateAndGrant).toHaveBeenCalledWith("user-1");
    expect(progress.listForUser).toHaveBeenCalledWith("user-1", ["2026-W45", "2026-W44"]);
  });

  it("is READY with the granted Coin and the week's note once completed and not opened", async () => {
    const { service, ledger } = build({ rows: [chestRow("2026-W45")] });
    const view = await service.getView("user-1");
    expect(view).toMatchObject({
      state: "READY",
      periodKey: "2026-W45",
      reward: { unit: "COIN", amount: 15 },
      summary: { activeDays: 2, focusSessions: 4, planTasks: 6, focusMinutes: 200 },
    });
    expect(ledger.findByRef).toHaveBeenCalledWith("quest", "row-2026-W45");
  });

  it("is OPENED once revealed", async () => {
    const { service } = build({ rows: [chestRow("2026-W45", true)] });
    expect((await service.getView("user-1")).state).toBe("OPENED");
  });

  it("puts last week's unopened chest first, with last week's days and numbers", async () => {
    const { service, signals } = build({ rows: [chestRow("2026-W44")] });
    const view = await service.getView("user-1");
    expect(view).toMatchObject({ state: "READY", periodKey: "2026-W44", carriedOver: true, current: 5 });
    expect(view.days[0]).toEqual({ date: "2026-10-26", active: true });
    expect(view.days[3]).toEqual({ date: "2026-10-29", active: false });
    expect(signals.getForDate).toHaveBeenCalledWith("user-1", "2026-11-01");
  });

  it("moves on to this week once last week's chest is opened", async () => {
    const { service } = build({ rows: [chestRow("2026-W44", true)] });
    expect(await service.getView("user-1")).toMatchObject({ state: "PROGRESS", periodKey: "2026-W45", carriedOver: false });
  });

  it("never carries a chest older than last week", async () => {
    const { service } = build({ rows: [chestRow("2026-W43")] });
    expect(await service.getView("user-1")).toMatchObject({ state: "PROGRESS", periodKey: "2026-W45" });
    await expect(service.open("user-1", "2026-W43")).rejects.toSatisfy(notFound);
  });

  it("opens with the week's effort and no Coin while the economy is off", async () => {
    const { service, ledger } = build({ economyEnabled: false, rows: [chestRow("2026-W45")] });
    const view = await service.getView("user-1");
    expect(view).toMatchObject({ state: "READY", reward: null, summary: { activeDays: 2 } });
    expect(view.rewardPendingMessage).toBeUndefined();
    expect(ledger.findByRef).not.toHaveBeenCalled();
    expect((await build({ economyEnabled: false }).service.getView("user-1")).reward).toBeNull();
  });

  it("is READY with a waiting message when the Coin is held by the earning cap", async () => {
    const { service } = build({ pending: ["weekly.effort-allowance:2026-W45"] });
    const view = await service.getView("user-1");
    expect(view).toMatchObject({
      state: "READY",
      reward: null,
      rewardPendingMessage: trEconomy.questRewardPending,
      summary: { activeDays: 2 },
    });
  });

  it("open stamps the chest, acks its Coin receipt, never grants, and repeats safely", async () => {
    const { service, quests, progress, receipts } = build({ rows: [chestRow("2026-W45")] });
    const first = await service.open("user-1", "2026-W45");
    expect(first).toMatchObject({ state: "OPENED", reward: { unit: "COIN", amount: 15 }, summary: { activeDays: 2 } });
    expect(progress.markRevealed).toHaveBeenCalledWith("user-1", "row-2026-W45");
    expect(receipts.markSeen).toHaveBeenCalledWith("user-1", ["ledger-row-2026-W45"]);
    expect(quests.evaluateAndGrant).not.toHaveBeenCalled();

    const again = build({ rows: [chestRow("2026-W45", true)] });
    expect(await again.service.open("user-1", "2026-W45")).toEqual(first);
    expect(again.progress.markRevealed).not.toHaveBeenCalled();
  });

  it("opens last week's carried chest", async () => {
    const { service, progress } = build({ rows: [chestRow("2026-W44")] });
    expect(await service.open("user-1", "2026-W44")).toMatchObject({ state: "OPENED", carriedOver: true });
    expect(progress.markRevealed).toHaveBeenCalledWith("user-1", "row-2026-W44");
  });

  it("carries last week's cap-held chest even without a progress row", async () => {
    const { service, quests } = build({ pending: ["weekly.effort-allowance:2026-W44"] });
    expect(await service.getView("user-1")).toMatchObject({
      state: "READY", periodKey: "2026-W44", carriedOver: true, reward: null,
      rewardPendingMessage: trEconomy.questRewardPending,
    });
    expect(quests.evaluateAndGrant).toHaveBeenCalledWith("user-1", "2026-11-01");
  });

  it("opens last week's cap-held chest without stamping it", async () => {
    const { service, quests, progress } = build({ pending: ["weekly.effort-allowance:2026-W44"] });
    expect(await service.open("user-1", "2026-W44")).toMatchObject({
      state: "READY", carriedOver: true, reward: null,
    });
    expect(quests.evaluateAndGrant).toHaveBeenCalledWith("user-1", "2026-11-01");
    expect(progress.markRevealed).not.toHaveBeenCalled();
  });

  it.each(["2026-W45", "2026-W44"])("opens a %s chest granted during the first open request", async (periodKey) => {
    const rows: Row[] = [];
    const { service, quests, progress, receipts } = build({ rows });
    quests.evaluateAndGrant.mockImplementation(async () => {
      rows.push(chestRow(periodKey));
      return [];
    });
    expect(await service.open("user-1", periodKey)).toMatchObject({ state: "OPENED", periodKey });
    expect(progress.markRevealed).toHaveBeenCalledWith("user-1", `row-${periodKey}`);
    expect(receipts.markSeen).toHaveBeenCalledWith("user-1", [`ledger-row-${periodKey}`]);
  });

  it("shows last week's chest when reevaluation finally grants its reward", async () => {
    const rows: Row[] = [];
    const { service, quests } = build({ rows });
    quests.evaluateAndGrant.mockImplementation(async (_userId?: string, date?: string) => {
      if (date === "2026-11-01") rows.push(chestRow("2026-W44"));
      return [];
    });
    expect(await service.getView("user-1")).toMatchObject({
      state: "READY", periodKey: "2026-W44", reward: { unit: "COIN", amount: 15 },
    });
  });

  it("open shows the note for a cap-held chest without stamping it", async () => {
    const { service, progress } = build({ pending: ["weekly.effort-allowance:2026-W45"] });
    expect(await service.open("user-1", "2026-W45")).toMatchObject({ state: "READY", reward: null });
    expect(progress.markRevealed).not.toHaveBeenCalled();
  });

  it("404s for a chest that is not completed or not in the two open weeks", async () => {
    await expect(build().service.open("user-1", "2026-W45")).rejects.toSatisfy(notFound);
    await expect(build().service.open("user-1", "2026-W46")).rejects.toSatisfy(notFound);
  });

  it("404s while the chest quest is switched off", async () => {
    const { service } = build({ disabledIds: "weekly.effort-allowance" });
    await expect(service.getView("user-1")).rejects.toSatisfy(notFound);
  });
});
