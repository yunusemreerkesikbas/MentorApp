import type { WeeklyChestSummary, WeeklyChestView } from "@mentor/types";

/** Small pure reads of the weekly chest, mirrored from the web's `weekly-chest-model.ts`. */

export function chestLamps(view: Pick<WeeklyChestView, "current" | "target">): boolean[] {
  return Array.from({ length: view.target }, (_, index) => index < view.current);
}

export function chestDaysLeft(view: Pick<WeeklyChestView, "current" | "target">): number {
  return Math.max(0, view.target - view.current);
}

/** Whether the week's remaining days (today too, unless it already counted) can still fill the chest. */
export function chestCanStillFill(
  view: Pick<WeeklyChestView, "current" | "target" | "days" | "today">,
): boolean {
  const open = view.days.filter((day) => day.date >= view.today && !day.active).length;
  return view.current + open >= view.target;
}

export interface NoteLine {
  key:
    | "chest_note_days"
    | "chest_note_sessions"
    | "chest_note_tasks"
    | "chest_note_focus_hm"
    | "chest_note_focus_h"
    | "chest_note_focus_m";
  values: Record<string, number>;
}

/** The handwritten lines on the chest note; a zero line is left off. */
export function noteLines(summary: WeeklyChestSummary): NoteLine[] {
  const lines: NoteLine[] = [];
  if (summary.activeDays > 0) lines.push({ key: "chest_note_days", values: { count: summary.activeDays } });
  if (summary.focusSessions > 0) {
    lines.push({ key: "chest_note_sessions", values: { count: summary.focusSessions } });
  }
  if (summary.planTasks > 0) lines.push({ key: "chest_note_tasks", values: { count: summary.planTasks } });
  if (summary.focusMinutes > 0) {
    const hours = Math.floor(summary.focusMinutes / 60);
    const minutes = summary.focusMinutes % 60;
    const key =
      hours === 0 ? "chest_note_focus_m" : minutes === 0 ? "chest_note_focus_h" : "chest_note_focus_hm";
    lines.push({ key, values: { hours, minutes } });
  }
  return lines;
}
