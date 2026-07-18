/**
 * Pure date helpers for coaching. All "day" math is done on UTC calendar dates
 * (yyyy-mm-dd) so it is deterministic and timezone-stable for the MVP.
 *
 * Gotcha (documented): the server treats the UTC date as "today". A per-user timezone
 * can be threaded through later without changing these pure helpers.
 */

/** Turkish month names (1-indexed via slice) for `formatTurkishDate`. */
const TURKISH_MONTHS = [
  "Ocak",
  "Şubat",
  "Mart",
  "Nisan",
  "Mayıs",
  "Haziran",
  "Temmuz",
  "Ağustos",
  "Eylül",
  "Ekim",
  "Kasım",
  "Aralık",
] as const;

/** A calendar date string, yyyy-mm-dd. */
export type IsoDate = string;

/** yyyy-mm-dd for a Date, in UTC. */
export function toIsoDate(date: Date): IsoDate {
  return date.toISOString().slice(0, 10);
}

/** The current UTC calendar date (yyyy-mm-dd). */
export function todayIso(now: Date = new Date()): IsoDate {
  return toIsoDate(now);
}

/** "YYYY-MM" month key for monthly freeze-token resets. */
export function monthKey(date: IsoDate): string {
  return date.slice(0, 7);
}

/** Parse a yyyy-mm-dd into a UTC midnight Date. */
export function parseIsoDate(date: IsoDate): Date {
  return new Date(`${date}T00:00:00Z`);
}

/** Add `days` (may be negative) to a yyyy-mm-dd date, returning yyyy-mm-dd. */
export function addDays(date: IsoDate, days: number): IsoDate {
  const d = parseIsoDate(date);
  d.setUTCDate(d.getUTCDate() + days);
  return toIsoDate(d);
}

/** Whole days from `from` to `to` (positive when `to` is later). */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  const ms = parseIsoDate(to).getTime() - parseIsoDate(from).getTime();
  return Math.round(ms / 86_400_000);
}

/** ISO-8601 week key for a date, e.g. "2026-W29" (Monday start; week year = its Thursday's year). */
export function isoWeekKey(date: IsoDate): string {
  const d = parseIsoDate(date);
  const day = d.getUTCDay() || 7; // Mon=1 … Sun=7
  d.setUTCDate(d.getUTCDate() + 4 - day); // shift to this week's Thursday
  const year = d.getUTCFullYear();
  const yearStart = Date.UTC(year, 0, 1);
  const week = Math.ceil(((d.getTime() - yearStart) / 86_400_000 + 1) / 7);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

/** The Monday (yyyy-mm-dd) of the ISO week containing `date`. */
export function isoWeekStart(date: IsoDate): IsoDate {
  const d = parseIsoDate(date);
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - (day - 1));
  return toIsoDate(d);
}

/** Format a yyyy-mm-dd as a Turkish display label, e.g. "12 Temmuz 2026". */
export function formatTurkishDate(date: IsoDate): string {
  const [year, month, day] = date.split("-").map((p) => Number(p));
  const monthName = TURKISH_MONTHS[(month ?? 1) - 1] ?? "";
  return `${day} ${monthName} ${year}`;
}
