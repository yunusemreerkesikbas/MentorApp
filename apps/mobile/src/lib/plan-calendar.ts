import {
  earliestStartMinute,
  monthGridDays,
  monthStart,
  PLAN_EVENT_NEUTRAL_SWATCH,
  planEventSwatch,
  planTaskCalendarItems,
  shiftDate,
  stepMonth,
  studentEventCalendarItem,
  weekStart,
  type MonthStep,
  type PlanCalendarItem,
  type PlanEventSwatch,
  type PlanEventSwatchToken,
  type PlanTaskItemLabels,
  type StudentEventLabels,
  type TimedInput,
} from "@mentor/core";
import type { PlanEventDto, PlanTaskDto } from "@mentor/types";
import type { ThemePalette } from "@mentor/ui/tokens";
import { mixHex } from "./layout.ts";
import { shiftPlanWeek } from "./plan-view.ts";

export type PlanCalendarScale = "day" | "week" | "month";

export function readPlanCalendarScale(raw: string | null): PlanCalendarScale {
  return raw === "day" || raw === "month" ? raw : "week";
}

export interface PlanCalendarState {
  anchor: string;
  selected: string;
  month: string;
  monthStep: MonthStep | null;
}

export function initialPlanCalendarState(today: string): PlanCalendarState {
  return { anchor: weekStart(today), selected: today, month: monthStart(today), monthStep: null };
}

export function boardDays(month: string): string[] {
  return monthGridDays(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1);
}

export function pickDay(state: PlanCalendarState, iso: string): PlanCalendarState {
  if (state.selected === iso && state.month === monthStart(iso) && state.monthStep === null) return state;
  return initialPlanCalendarState(iso);
}

export function followDay(state: PlanCalendarState, iso: string): PlanCalendarState {
  if (state.selected === iso && state.monthStep === null) return state;
  const next = initialPlanCalendarState(iso);
  return { ...next, month: boardDays(state.month).includes(iso) ? state.month : next.month };
}

export function stepCalendar(
  state: PlanCalendarState,
  scale: PlanCalendarScale,
  direction: -1 | 1,
  today: string,
): PlanCalendarState {
  if (scale === "day") return pickDay(state, shiftDate(state.selected, direction));
  if (scale === "week") return followDay(state, shiftPlanWeek(state, direction * 7, today).selected);
  const selectedMonth = monthStart(state.selected);
  // The selection can be in an adjacent month while Ay still shows the previous Ajanda board.
  const fromBoard = selectedMonth < state.month ? 1 : selectedMonth > state.month ? -1 : 0;
  const monthStep = stepMonth(state.selected, direction + fromBoard, state.monthStep);
  return { ...pickDay(state, monthStep.date), monthStep };
}

export const PLAN_DAY_HOUR_HEIGHT = 56;

export function dayGridInitialOffset(items: TimedInput[]): number {
  const firstHour = earliestStartMinute(items, 7 * 60) / 60;
  return Math.max(0, (firstHour - 0.5) * PLAN_DAY_HOUR_HEIGHT);
}

export function boardWeekRow(days: readonly string[], selected: string): number {
  return Math.max(0, Math.floor(days.indexOf(selected) / 7));
}

export function agendaActiveDay(
  tops: readonly { iso: string; top: number }[],
  scrollTop: number,
): string | null {
  let active: string | null = null;
  for (const { iso, top } of tops) {
    if (top > scrollTop + 8) break;
    active = iso;
  }
  return active;
}

type SubjectsByDate = Record<string, readonly { subject: string | null }[]>;

export function legendSubjects(
  tasksByDate: SubjectsByDate,
  monthKey: string,
): { subject: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const [iso, tasks] of Object.entries(tasksByDate)) {
    if (iso.slice(0, 7) !== monthKey) continue;
    for (const task of tasks) {
      const subject = task.subject?.trim();
      if (subject) counts.set(subject, (counts.get(subject) ?? 0) + 1);
    }
  }
  return Array.from(counts, ([subject, count]) => ({ subject, count }))
    .sort((a, b) => b.count - a.count || a.subject.localeCompare(b.subject, "tr"));
}

export function highlightedSubject(
  picked: string | null,
  tasksByDate: SubjectsByDate,
  monthKey: string,
): string | null {
  return picked && legendSubjects(tasksByDate, monthKey).some(({ subject }) => subject === picked) ? picked : null;
}

type CalendarPalette = Pick<ThemePalette, PlanEventSwatchToken | "surface">;

export interface PlanEventTint {
  bg: string;
  bar: string;
}

export function planEventTint(swatch: PlanEventSwatch, palette: CalendarPalette): PlanEventTint {
  const bar = palette[swatch.token];
  return { bar, bg: mixHex(bar, palette.surface, swatch.tint / 100) };
}

export type PlanBoardItem = PlanCalendarItem<PlanTaskDto | PlanEventDto, PlanEventTint>;

export function calendarItemsByDate(
  tasksByDate: Record<string, PlanTaskDto[]>,
  eventsByDate: Record<string, PlanEventDto[]>,
  viewerId: string,
  labels: PlanTaskItemLabels & StudentEventLabels,
  palette: CalendarPalette,
): Record<string, PlanBoardItem[]> {
  const result: Record<string, PlanBoardItem[]> = planTaskCalendarItems(
    tasksByDate,
    labels,
    (subject) => planEventTint(planEventSwatch(subject), palette),
  );
  const neutral = planEventTint(PLAN_EVENT_NEUTRAL_SWATCH, palette);
  for (const [iso, events] of Object.entries(eventsByDate)) {
    result[iso] = [
      ...(result[iso] ?? []),
      ...events.map((event) => studentEventCalendarItem(event, viewerId, labels, neutral)),
    ];
  }
  return result;
}
