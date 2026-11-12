import type { WeeklyChestView } from "@mentor/types";

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
