/**
 * Pure geometry for the Plan calendar (Gün / Hafta / Ay). Lives outside the components so the
 * math is unit-testable and the views stay declarative.
 *
 * Convention shared with the API: `startTime === null` means the item is ALL-DAY. Times are
 * wall-clock "HH:MM" on the task's own date — no timezone conversion anywhere in this file.
 */

export const DAY_MINUTES = 24 * 60;
/** Open-ended events (start but no end) render as this long. */
export const DEFAULT_EVENT_MINUTES = 60;
/** Floor so a 10-minute event still shows its title. */
const MIN_DISPLAY_MINUTES = 30;

export interface TimedInput {
  startTime: string | null;
  endTime: string | null;
}

export interface TimedEventLayout<T> {
  event: T;
  startMin: number;
  endMin: number;
  /** Percentage of the 24h column. */
  topPct: number;
  heightPct: number;
  /** 0-based lane among overlapping events, and how many lanes that cluster needs. */
  col: number;
  colCount: number;
}

export interface DayLayout<T> {
  allDay: T[];
  timed: TimedEventLayout<T>[];
}

export function minutesFromHhmm(value: string): number {
  const [h, m] = value.split(":");
  return Number(h) * 60 + Number(m);
}

export function hhmmFromMinutes(minutes: number): string {
  const clamped = Math.max(0, Math.min(DAY_MINUTES - 1, Math.round(minutes)));
  const h = String(Math.floor(clamped / 60)).padStart(2, "0");
  const m = String(clamped % 60).padStart(2, "0");
  return `${h}:${m}`;
}

function isoOf(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * The 42 ISO dates of a Monday-start month grid (6 rows × 7 days) — always 6 rows so the grid
 * height never jumps between months.
 */
export function monthGridDays(year: number, monthIndex: number): string[] {
  const first = new Date(year, monthIndex, 1, 12);
  const backToMonday = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - backToMonday);
  return Array.from({ length: 42 }, (_, i) => {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    return isoOf(day);
  });
}

/**
 * Split one day's items into the all-day row and positioned time blocks.
 *
 * Overlapping events are packed into lanes: each event takes the first lane free at its start,
 * and every event in a transitively-overlapping cluster reports the same `colCount` so their
 * widths line up.
 *
 * ponytail: O(n²) worst case over one day's items — a study plan has tens, not thousands.
 * If day capacity ever becomes unbounded, switch to a sweep over sorted endpoints.
 */
export function layoutDayEvents<T extends TimedInput>(events: T[]): DayLayout<T> {
  const allDay: T[] = [];
  const timed: { event: T; startMin: number; endMin: number }[] = [];

  for (const event of events) {
    if (!event.startTime) {
      allDay.push(event);
      continue;
    }
    const startMin = Math.min(minutesFromHhmm(event.startTime), DAY_MINUTES - 1);
    const rawEnd = event.endTime ? minutesFromHhmm(event.endTime) : startMin + DEFAULT_EVENT_MINUTES;
    // Defensive: validation + a DB CHECK already reject end <= start, but a bad row must not
    // produce a negative-height block.
    const endMin = Math.min(DAY_MINUTES, Math.max(rawEnd, startMin + 1));
    timed.push({ event, startMin, endMin });
  }

  timed.sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);

  const layouts: TimedEventLayout<T>[] = [];
  let clusterStart = 0;
  let clusterEnd = -1;
  /** Lane index → end minute of the last event placed in that lane. */
  let lanes: number[] = [];

  const closeCluster = (untilIndex: number) => {
    const colCount = Math.max(1, lanes.length);
    for (let i = clusterStart; i < untilIndex; i++) layouts[i]!.colCount = colCount;
  };

  for (const item of timed) {
    if (item.startMin >= clusterEnd) {
      closeCluster(layouts.length);
      clusterStart = layouts.length;
      clusterEnd = item.endMin;
      lanes = [];
    } else {
      clusterEnd = Math.max(clusterEnd, item.endMin);
    }

    let col = lanes.findIndex((laneEnd) => laneEnd <= item.startMin);
    if (col === -1) {
      col = lanes.length;
      lanes.push(item.endMin);
    } else {
      lanes[col] = item.endMin;
    }

    const displayEnd = Math.max(item.endMin, item.startMin + MIN_DISPLAY_MINUTES);
    layouts.push({
      event: item.event,
      startMin: item.startMin,
      endMin: item.endMin,
      topPct: (item.startMin / DAY_MINUTES) * 100,
      heightPct: (Math.min(displayEnd, DAY_MINUTES) - item.startMin) / DAY_MINUTES * 100,
      col,
      colCount: 1,
    });
  }
  closeCluster(layouts.length);

  return { allDay, timed: layouts };
}

/** Earliest minute of the day that has content — used to auto-scroll the hour grid. */
export function earliestStartMinute<T extends TimedInput>(
  events: T[],
  fallback: number,
): number {
  let earliest: number | null = null;
  for (const event of events) {
    if (!event.startTime) continue;
    const min = minutesFromHhmm(event.startTime);
    if (earliest === null || min < earliest) earliest = min;
  }
  return earliest ?? fallback;
}
