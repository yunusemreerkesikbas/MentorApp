/**
 * The composer's day math, in the coach's LOCAL calendar.
 *
 * Local rather than UTC on purpose: these dates become the day chips a coach clicks, and a coach
 * in Istanbul picking "today" must not get yesterday's chip because the browser was three hours
 * ahead of UTC midnight. `repeat-week.ts` does its arithmetic in UTC instead, because there both
 * ends of the subtraction are `yyyy-mm-dd` strings the API produced.
 */

/** Today in the browser's local calendar as `yyyy-mm-dd`. The past is refused server-side. */
export function todayLocalIso(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

export function addDaysIso(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00`);
  date.setDate(date.getDate() + days);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

/** Whole days from `a` to `b`, both `yyyy-mm-dd`, in the same local calendar. */
export function daysBetweenIso(a: string, b: string): number {
  const from = new Date(`${a}T00:00:00`);
  const to = new Date(`${b}T00:00:00`);
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}
