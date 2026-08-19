const ISTANBUL_TIME_ZONE = "Europe/Istanbul";
const DAY_MS = 86_400_000;

const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: ISTANBUL_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Seven complete local calendar days must sit between the two activity dates. */
export function hasSevenFullIstanbulDaysBetween(previous: Date, current: Date): boolean {
  const toUtcDay = (value: Date): number => {
    const parts = Object.fromEntries(
      dayFormatter.formatToParts(value).map((part) => [part.type, part.value]),
    );
    return Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day));
  };
  return (toUtcDay(current) - toUtcDay(previous)) / DAY_MS >= 8;
}
