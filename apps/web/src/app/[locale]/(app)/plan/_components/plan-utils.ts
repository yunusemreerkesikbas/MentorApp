export {
  todayIso,
  isPastDate,
  shiftDate,
  weekStart,
  weekDates,
  monthIsoBounds,
  formatDateLabel,
  formatWeekdayShort,
  formatDayNumber,
  formatMonthDayShort,
  formatWeekRangeLabel,
  monthStart,
  shiftMonth,
  type MonthStep,
  stepMonth,
  formatMonthTitle,
  formatTimeRange,
  taskStats,
  weekCompletionStats,
} from "@mentor/core";

export type PlanViewMode = "list" | "timeline" | "calendar";
/** Zoom level inside the Takvim view. */
export type PlanCalendarScale = "day" | "week" | "month";
/** Shared Takvim chrome copy. Keys the grids read must exist in both namespaces. */
export type PlanCalendarCopyNamespace = "plan" | "coachPlan";

const VIEW_STORAGE_KEY = "mentor.plan.viewMode";
const SCALE_STORAGE_KEY = "mentor.plan.calendarScale";

/** DOM id for a day section in the weekly Timeline chronology. */
export function planTimelineDayId(iso: string): string {
  return `plan-timeline-day-${iso}`;
}

export function readStoredViewMode(): PlanViewMode {
  if (typeof window === "undefined") return "list";
  const raw = window.localStorage.getItem(VIEW_STORAGE_KEY);
  // "week" is the pre-calendar name of this view — migrate silently so returning users
  // don't land back on Liste.
  if (raw === "week") return "calendar";
  if (raw === "list" || raw === "timeline" || raw === "calendar") return raw;
  return "list";
}

export function persistViewMode(mode: PlanViewMode): void {
  window.localStorage.setItem(VIEW_STORAGE_KEY, mode);
}

export function readStoredCalendarScale(
  storageKey: string = SCALE_STORAGE_KEY,
): PlanCalendarScale {
  if (typeof window === "undefined") return "week";
  const raw = window.localStorage.getItem(storageKey);
  if (raw === "day" || raw === "week" || raw === "month") return raw;
  return "week";
}

export function persistCalendarScale(
  scale: PlanCalendarScale,
  storageKey: string = SCALE_STORAGE_KEY,
): void {
  window.localStorage.setItem(storageKey, scale);
}
