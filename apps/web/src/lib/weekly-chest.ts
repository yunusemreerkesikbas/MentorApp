import type { WeeklyChestView } from "@mentor/types";
import {
  economyControllerWeeklyChestOpen,
  economyControllerWeeklyChestView,
} from "@mentor/api-client";

/** Ledger reason of the chest's Coin; its receipt waits for the opening scene, not the coin modal. */
export const WEEKLY_CHEST_REASON = "quest.weekly.effort-allowance";

export function fetchWeeklyChest(): Promise<WeeklyChestView> {
  return economyControllerWeeklyChestView() as Promise<WeeklyChestView>;
}

/** Idempotent; also acknowledges the chest's Coin receipt. */
export function openWeeklyChest(periodKey: string): Promise<WeeklyChestView> {
  return economyControllerWeeklyChestOpen({ periodKey }) as Promise<WeeklyChestView>;
}

interface NoticeMemory {
  /** The READY chest the student already heard about (panel or toast). */
  noticed?: string;
  /** UTC day on which nothing can change any more, so the app shell stops asking. */
  quietDay?: string;
}

const memoryKey = (userId: string) => `mentor:weekly-chest:${userId}`;

export function readNoticeMemory(userId: string): NoticeMemory {
  try {
    return JSON.parse(window.localStorage.getItem(memoryKey(userId)) ?? "{}") as NoticeMemory;
  } catch {
    return {};
  }
}

export function writeNoticeMemory(userId: string, patch: NoticeMemory): void {
  try {
    window.localStorage.setItem(memoryKey(userId), JSON.stringify({ ...readNoticeMemory(userId), ...patch }));
  } catch {
    // Private mode: the toast may repeat once more; nothing else depends on it.
  }
}
