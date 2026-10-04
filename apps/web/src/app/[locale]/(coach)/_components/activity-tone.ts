/**
 * The coach's activity drawings (the roster row's strip, the report's rhythm grid) bucket a day's
 * focus minutes into the steps of one ordinal ramp (DESIGN.md §2.3, `--chart-activity-*`, checked
 * light and dark with the dataviz validator). An empty day is the track, not a step: nothing is
 * absence, not a small amount.
 */
export type ActivityTone = 0 | 1 | 2 | 3;

/** Where tones 2 and 3 start, in minutes. Tone 1 is anything above zero. */
export const ACTIVITY_STEPS = [30, 90] as const;

export function activityTone(minutes: number): ActivityTone {
  if (minutes <= 0) return 0;
  if (minutes < ACTIVITY_STEPS[0]) return 1;
  if (minutes < ACTIVITY_STEPS[1]) return 2;
  return 3;
}

export const ACTIVITY_TONE_CLASS: Record<ActivityTone, string> = {
  0: "bg-[var(--play-track)]",
  1: "bg-[var(--chart-activity-1)]",
  2: "bg-[var(--chart-activity-2)]",
  3: "bg-[var(--chart-activity-3)]",
};

/** The text a drawing stands for: days with any focus, and the minutes in total. */
export function summarizeActivity(minutes: readonly number[]): {
  activeDays: number;
  totalMinutes: number;
} {
  return {
    activeDays: minutes.filter((value) => value > 0).length,
    totalMinutes: minutes.reduce((sum, value) => sum + value, 0),
  };
}

/** The calendar day of each entry of a series whose last entry is `today` (both `yyyy-mm-dd`). */
export function seriesDates(length: number, today: string): string[] {
  const end = Date.parse(`${today}T00:00:00.000Z`);
  return Array.from({ length }, (_, index) =>
    new Date(end - (length - 1 - index) * 86_400_000).toISOString().slice(0, 10),
  );
}
