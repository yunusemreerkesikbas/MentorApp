import { describe, expect, it } from "vitest";
import type { WeeklyChestView } from "@mentor/types";
import { cannotOpenToday, chestLamps, daysLeft, isHeldChestReceipt, noteLines, weekCanStillFill } from "./weekly-chest-model";

const week = (active: boolean[]): WeeklyChestView["days"] =>
  active.map((on, index) => ({ date: `2026-11-0${index + 2}`, active: on }));

function view(overrides: Partial<WeeklyChestView> = {}): WeeklyChestView {
  return {
    state: "PROGRESS",
    periodKey: "2026-W45",
    carriedOver: false,
    current: 3,
    target: 5,
    days: week([true, true, true, false, false, false, false]),
    today: "2026-11-05",
    reward: { unit: "COIN", amount: 15 },
    ...overrides,
  };
}

describe("chestLamps / daysLeft", () => {
  it("lights one lamp per active day up to the target", () => {
    expect(chestLamps(view())).toEqual([true, true, true, false, false]);
    expect(chestLamps(view({ current: 7, target: 5 }))).toEqual([true, true, true, true, true]);
    expect(daysLeft(view())).toBe(2);
    expect(daysLeft(view({ current: 6 }))).toBe(0);
  });
});

describe("weekCanStillFill", () => {
  it("counts only the days still to come, today included unless it already counted", () => {
    expect(weekCanStillFill(view())).toBe(true); // Thursday, 3/5: Thu–Sun left
    expect(weekCanStillFill(view({ today: "2026-11-07" }))).toBe(true); // Saturday: Sat + Sun
    expect(weekCanStillFill(view({ today: "2026-11-08" }))).toBe(false); // Sunday: one day for two
    expect(weekCanStillFill(view({ current: 4, days: week([true, true, true, false, false, false, true]), today: "2026-11-08" }))).toBe(false);
    expect(weekCanStillFill(view({ current: 4, days: week([true, true, true, true, false, false, false]), today: "2026-11-08" }))).toBe(true);
  });
});

describe("noteLines", () => {
  it("writes days, sessions, tasks and focus as 3 sa 20 dk", () => {
    expect(noteLines({ activeDays: 5, focusSessions: 4, planTasks: 6, focusMinutes: 200 })).toEqual([
      { key: "note_days", values: { count: 5 } },
      { key: "note_sessions", values: { count: 4 } },
      { key: "note_tasks", values: { count: 6 } },
      { key: "note_focus_hm", values: { hours: 3, minutes: 20 } },
    ]);
  });

  it("leaves zero lines out and drops the empty half of the focus time", () => {
    expect(noteLines({ activeDays: 5, focusSessions: 0, planTasks: 5, focusMinutes: 0 }).map((line) => line.key)).toEqual([
      "note_days",
      "note_tasks",
    ]);
    expect(noteLines({ activeDays: 5, focusSessions: 2, planTasks: 0, focusMinutes: 120 })[2]).toEqual({
      key: "note_focus_h",
      values: { hours: 2, minutes: 0 },
    });
    expect(noteLines({ activeDays: 5, focusSessions: 1, planTasks: 0, focusMinutes: 45 })[2]).toEqual({
      key: "note_focus_m",
      values: { hours: 0, minutes: 45 },
    });
  });
});

describe("cannotOpenToday", () => {
  it("keeps asking only while today's first action could finish the week", () => {
    expect(cannotOpenToday(view({ current: 4 }))).toBe(false);
    expect(cannotOpenToday(view({ current: 3 }))).toBe(true);
    expect(cannotOpenToday(view({ current: 4, days: week([true, true, true, true, false, false, false]), today: "2026-11-05" }))).toBe(true);
    expect(cannotOpenToday(view({ state: "READY", current: 5 }))).toBe(true);
    expect(cannotOpenToday(view({ state: "OPENED", current: 5 }))).toBe(true);
  });
});

describe("isHeldChestReceipt", () => {
  const now = Date.parse("2026-11-09T09:00:00Z");

  it("holds a fresh chest receipt for the scene and lets other or stale ones through", () => {
    expect(isHeldChestReceipt({ reason: "quest.weekly.effort-allowance", createdAt: "2026-11-08T20:00:00Z" }, now)).toBe(true);
    expect(isHeldChestReceipt({ reason: "quest.daily.focus", createdAt: "2026-11-08T20:00:00Z" }, now)).toBe(false);
    expect(isHeldChestReceipt({ reason: "quest.weekly.effort-allowance", createdAt: "2026-10-20T20:00:00Z" }, now)).toBe(false);
  });
});
