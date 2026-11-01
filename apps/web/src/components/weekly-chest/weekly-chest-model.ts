import type { EconomyLedgerEntryView, WeeklyChestSummary, WeeklyChestView } from "@mentor/types";
import { WEEKLY_CHEST_REASON } from "@/lib/weekly-chest";

/** One lamp per target day on the chest's brass strip; the first `current` are lit. */
export function chestLamps(view: Pick<WeeklyChestView, "current" | "target">): boolean[] {
  return Array.from({ length: view.target }, (_, index) => index < view.current);
}

export function daysLeft(view: Pick<WeeklyChestView, "current" | "target">): number {
  return Math.max(0, view.target - view.current);
}

/** Whether the week's remaining days (today too, unless it already counted) can still fill the chest. */
export function weekCanStillFill(view: Pick<WeeklyChestView, "current" | "target" | "days" | "today">): boolean {
  const open = view.days.filter((day) => day.date >= view.today && !day.active).length;
  return view.current + open >= view.target;
}

export type NoteLine =
  | { key: "note_days" | "note_sessions" | "note_tasks"; values: { count: number } }
  | { key: "note_focus_hm" | "note_focus_h" | "note_focus_m"; values: { hours: number; minutes: number } };

/** The note's lines, in reading order; a zero line is left out rather than written as "0". */
export function noteLines(summary: WeeklyChestSummary): NoteLine[] {
  const lines: NoteLine[] = [];
  if (summary.activeDays > 0) lines.push({ key: "note_days", values: { count: summary.activeDays } });
  if (summary.focusSessions > 0) lines.push({ key: "note_sessions", values: { count: summary.focusSessions } });
  if (summary.planTasks > 0) lines.push({ key: "note_tasks", values: { count: summary.planTasks } });
  if (summary.focusMinutes > 0) {
    const hours = Math.floor(summary.focusMinutes / 60);
    const minutes = summary.focusMinutes % 60;
    const key = hours === 0 ? "note_focus_m" : minutes === 0 ? "note_focus_h" : "note_focus_hm";
    lines.push({ key, values: { hours, minutes } });
  }
  return lines;
}

/**
 * True while no action today can make a PROGRESS chest ready: today already counts, or one more day
 * still leaves it short. The app shell then stops asking until tomorrow.
 */
export function cannotOpenToday(view: WeeklyChestView): boolean {
  if (view.state !== "PROGRESS") return true;
  const todayActive = view.days.some((day) => day.date === view.today && day.active);
  return todayActive || view.current + 1 < view.target;
}

/** The chest's own Coin receipt waits for the scene; one older than two weeks can no longer open. */
const HELD_RECEIPT_MS = 14 * 24 * 60 * 60 * 1000;

export function isHeldChestReceipt(entry: Pick<EconomyLedgerEntryView, "reason" | "createdAt">, now: number): boolean {
  return entry.reason === WEEKLY_CHEST_REASON && now - Date.parse(entry.createdAt) < HELD_RECEIPT_MS;
}
