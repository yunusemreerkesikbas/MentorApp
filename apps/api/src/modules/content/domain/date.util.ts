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

const ISTANBUL_DATE_FORMATTER = new Intl.DateTimeFormat("en", {
  timeZone: "Europe/Istanbul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function toIsoDate(date: Date): IsoDate {
  return date.toISOString().slice(0, 10);
}

/** Calendar day in the product's canonical timezone (`Europe/Istanbul`), matching `TodayService`. */
export function todayInIstanbul(now: Date = new Date()): IsoDate {
  const parts = ISTANBUL_DATE_FORMATTER.formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function todayIso(now: Date = new Date()): IsoDate {
  return todayInIstanbul(now);
}

export function isoDaysAgo(days: number, now: Date = new Date()): IsoDate {
  const date = new Date(`${todayIso(now)}T00:00:00Z`);
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
