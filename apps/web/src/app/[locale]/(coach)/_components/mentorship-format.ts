/**
 * Shared formatting for the coach surface. Small, pure, and in one file so the roster and the
 * report can never disagree about what "3 gün önce" or a 0.43 completion rate looks like.
 */

/** Whole days between an ISO date (`yyyy-mm-dd`) and today, UTC — matching the API's day math. */
export function daysSince(isoDate: string, now = new Date()): number {
  const today = now.toISOString().slice(0, 10);
  const ms = Date.parse(`${today}T00:00:00.000Z`) - Date.parse(`${isoDate}T00:00:00.000Z`);
  return Math.round(ms / 86_400_000);
}

export type RelativeDay =
  | { kind: "never" }
  | { kind: "today" }
  | { kind: "yesterday" }
  | { kind: "daysAgo"; days: number };

/** "Never / today / yesterday / N days ago" as data, so the caller does the localizing. */
export function relativeDay(isoDate: string | null, now = new Date()): RelativeDay {
  if (isoDate === null) return { kind: "never" };
  const days = daysSince(isoDate, now);
  if (days <= 0) return { kind: "today" };
  if (days === 1) return { kind: "yesterday" };
  return { kind: "daysAgo", days };
}

/** 0.4285 → "43%". Null stays null so the caller can render a dash instead of a fake zero. */
export function formatRate(rate: number | null, locale: string): string | null {
  if (rate === null) return null;
  return new Intl.NumberFormat(locale, {
    style: "percent",
    maximumFractionDigits: 0,
  }).format(rate);
}

/** Nets carry two decimals in the DB but read better trimmed when they are whole. */
export function formatNet(net: number | null, locale: string): string | null {
  if (net === null) return null;
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(net);
}

export function formatMood(level: number | null, locale: string): string | null {
  if (level === null) return null;
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(level);
}

export function formatDate(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}
