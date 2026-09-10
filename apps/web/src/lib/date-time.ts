const ISTANBUL_TIME_ZONE = "Europe/Istanbul";

/** Calendar date in the product's canonical timezone, independent of browser or server locale. */
export function todayInIstanbul(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ISTANBUL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}
