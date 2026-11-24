const tag = (locale: string) => (locale === "en" ? "en-GB" : "tr-TR");

/** "16 Kasım" for a date-only ISO string, read in UTC like the web (`timeZone: "UTC"`). */
export function formatRecapDay(iso: string, locale: string): string {
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString(tag(locale), {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

/** "16 Kasım" for an instant, in the device's own time zone. */
export function formatRecapInstant(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(tag(locale), { day: "numeric", month: "long" });
}

/** "10 – 16 Kasım", or "28 Ekim – 3 Kasım" across a month (the web's `dateTimeRange`). */
export function formatRecapRange(start: string, end: string, locale: string): string {
  const from =
    start.slice(0, 7) === end.slice(0, 7)
      ? String(Number(start.slice(8, 10)))
      : formatRecapDay(start, locale);
  return `${from} – ${formatRecapDay(end, locale)}`;
}
