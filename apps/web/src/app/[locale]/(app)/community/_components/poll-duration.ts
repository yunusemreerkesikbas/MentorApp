export interface PollDurationParts {
  days: number;
  hours: number;
  minutes: number;
}

const MAX_POLL_MINUTES = 7 * 24 * 60;

export function durationToMinutes(parts: PollDurationParts): number {
  return Math.min(MAX_POLL_MINUTES, parts.days * 1_440 + parts.hours * 60 + parts.minutes);
}

export function durationParts(totalMinutes: number): PollDurationParts {
  const bounded = Math.max(0, Math.min(MAX_POLL_MINUTES, totalMinutes));
  const days = Math.floor(bounded / 1_440);
  const remainder = bounded % 1_440;
  return {
    days,
    hours: Math.floor(remainder / 60),
    minutes: remainder % 60,
  };
}
