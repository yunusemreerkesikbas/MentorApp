import type { CoachPlanItemDto } from "@mentor/types";

export type CoachPlanScale = "week" | "month";

export interface CoachPlanRange {
  from: string;
  to: string;
  days: string[];
}

export interface CoachPlanAvatar {
  studentId: string;
  studentDisplayName: string;
  avatarUrl: string | null;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function parseDate(value: string): Date {
  return new Date(`${value}T12:00:00.000Z`);
}

function formatDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function addDays(value: string, amount: number): string {
  const date = parseDate(value);
  date.setUTCDate(date.getUTCDate() + amount);
  return formatDate(date);
}

function isIsoDate(value: string): boolean {
  return ISO_DATE.test(value) && formatDate(parseDate(value)) === value;
}

function mondayOnOrBefore(value: string): string {
  const day = parseDate(value).getUTCDay();
  return addDays(value, -((day + 6) % 7));
}

export function coachPlanRange(anchor: string, scale: CoachPlanScale): CoachPlanRange {
  const monthStart = `${anchor.slice(0, 7)}-01`;
  const from = mondayOnOrBefore(scale === "week" ? anchor : monthStart);
  const dayCount = scale === "week" ? 7 : 42;
  const days = Array.from({ length: dayCount }, (_, index) => addDays(from, index));
  return { from, to: days.at(-1)!, days };
}

function dateAndTime(item: CoachPlanItemDto): [string, string] {
  return item.kind === "TASK"
    ? [item.task.taskDate, item.task.startTime ?? ""]
    : [item.event.eventDate, item.event.startTime ?? ""];
}

export function sortCoachPlanItems(items: readonly CoachPlanItemDto[]): CoachPlanItemDto[] {
  return items
    .map((item, index) => ({ item, index, key: dateAndTime(item) }))
    .sort((left, right) => {
      const byDate = left.key[0].localeCompare(right.key[0]);
      const byTime = left.key[1].localeCompare(right.key[1]);
      return byDate || byTime || left.index - right.index;
    })
    .map(({ item }) => item);
}

export function itemsForCoachPlanDay(
  items: readonly CoachPlanItemDto[],
  date: string,
): CoachPlanItemDto[] {
  return sortCoachPlanItems(
    items.filter((item) =>
      item.kind === "TASK" ? item.task.taskDate === date : item.event.eventDate === date,
    ),
  );
}

export function uniqueStudentAvatars(
  items: readonly CoachPlanItemDto[],
  limit: number,
): {
  students: CoachPlanAvatar[];
  overflow: number;
  total: number;
  allNames: string[];
} {
  const students = new Map<string, CoachPlanAvatar>();
  for (const item of items) {
    const people = item.kind === "TASK" ? item.task.participants : item.event.attendees;
    for (const person of people) {
      if (!students.has(person.studentId)) {
        students.set(person.studentId, {
          studentId: person.studentId,
          studentDisplayName: person.studentDisplayName,
          avatarUrl: person.avatarUrl,
        });
      }
    }
  }
  const all = [...students.values()];
  return {
    students: all.slice(0, limit),
    overflow: Math.max(0, all.length - limit),
    total: all.length,
    allNames: all.map((student) => student.studentDisplayName),
  };
}

export function isCoachPlanItemShared(item: CoachPlanItemDto): boolean {
  return item.kind === "TASK"
    ? item.task.participants.length > 0
    : item.event.attendeeCount > 0;
}

export function coachPlanQueryTransition(query: {
  date: string | null;
  event: string | null;
}): { anchor: string; selectedDate: string; eventId: string | null } | null {
  if (!query.date || !isIsoDate(query.date)) return null;
  return {
    anchor: query.date,
    selectedDate: query.date,
    eventId: query.event?.trim() || null,
  };
}

export function coachPlanQueryKey(query: {
  date: string | null;
  event: string | null;
}): string {
  return JSON.stringify([query.date, query.event?.trim() || null]);
}

export function consumeInitialCoachPlanEvent(
  state: { pendingEventId: string | null },
  items: readonly CoachPlanItemDto[],
): {
  applied: boolean;
  pendingEventId: null;
  item: CoachPlanItemDto | null;
} {
  if (state.pendingEventId === null) {
    return { applied: false, pendingEventId: null, item: null };
  }
  const item = items.find(
    (candidate) =>
      candidate.kind === "EVENT" && candidate.event.id === state.pendingEventId,
  );
  return { applied: true, pendingEventId: null, item: item ?? null };
}

export interface CoachPlanFocusTrigger {
  readonly isConnected: boolean;
  focus: () => void;
}

export function restoreCoachPlanTrigger(
  trigger: CoachPlanFocusTrigger | null,
): void {
  if (trigger?.isConnected) trigger.focus();
}

export function coachPlanWeekdayLabels(
  locale: string,
  width: "short" | "long" = "short",
): string[] {
  const formatter = new Intl.DateTimeFormat(locale, { weekday: width });
  return Array.from({ length: 7 }, (_, index) =>
    formatter.format(new Date(`2026-09-${String(7 + index).padStart(2, "0")}T12:00:00Z`)),
  );
}

export function parseCoachPlanSelection(
  query: { date: string | null; event: string | null },
  range: Pick<CoachPlanRange, "from" | "to">,
): { date: string | null; eventId: string | null } {
  const date =
    query.date && isIsoDate(query.date) && query.date >= range.from && query.date <= range.to
      ? query.date
      : null;
  const eventId = date && query.event?.trim() ? query.event.trim() : null;
  return { date, eventId };
}
