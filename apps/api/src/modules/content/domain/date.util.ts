/** Turkish date formatting for content data cards (same rules as coaching/date.util). */

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

export type IsoDate = string;

export function toIsoDate(date: Date): IsoDate {
  return date.toISOString().slice(0, 10);
}

export function todayIso(now: Date = new Date()): IsoDate {
  return toIsoDate(now);
}

export function isoDaysAgo(days: number, now: Date = new Date()): IsoDate {
  const date = new Date(now);
  date.setUTCDate(date.getUTCDate() - days);
  return toIsoDate(date);
}

export function daysBetween(from: IsoDate, to: IsoDate): number {
  const ms = new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime();
  return Math.round(ms / 86_400_000);
}

export function formatTurkishDate(date: IsoDate): string {
  const [year, month, day] = date.split("-").map((p) => Number(p));
  const monthName = TURKISH_MONTHS[(month ?? 1) - 1] ?? "";
  return `${day} ${monthName} ${year}`;
}
