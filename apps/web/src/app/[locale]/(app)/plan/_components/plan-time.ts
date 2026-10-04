const CLOCK = /^(\d{1,2}):(\d{2})$/;
const MINUTE_STEP = 5;

/** Zero-padded `HH:mm`, or null when the text is not a clock time. */
export function canonicalHm(value: string): string | null {
  const match = CLOCK.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return `${pad(hour)}:${pad(minute)}`;
}

/** Five-minute ticks, plus the current minute when it falls off the grid. */
export function minuteChoices(minute: number | null): number[] {
  const steps = Array.from({ length: 60 / MINUTE_STEP }, (_, index) => index * MINUTE_STEP);
  if (minute === null || steps.includes(minute)) return steps;
  return [...steps, minute].sort((left, right) => left - right);
}

export function pad(value: number): string {
  return String(value).padStart(2, "0");
}
