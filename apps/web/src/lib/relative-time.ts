const THRESHOLDS: Array<{ unit: Intl.RelativeTimeFormatUnit; secs: number }> = [
  { unit: "second", secs: 60 },
  { unit: "minute", secs: 3600 },
  { unit: "hour", secs: 86400 },
  { unit: "day", secs: Infinity },
];

export function relativeTime(iso: string, locale = "tr"): string {
  const diff = (Date.parse(iso) - Date.now()) / 1000;
  const abs = Math.abs(diff);
  const fmt = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  let prev = 1;
  for (const { unit, secs } of THRESHOLDS) {
    if (abs < secs) return fmt.format(Math.round(diff / prev), unit);
    prev = secs;
  }
  return fmt.format(Math.round(diff / 86400), "day");
}
