import type { WeeklyRecapTeaserDto } from "@mentor/types";

export const RECAP_LEASE_MS = 5 * 60 * 1000;
export const RECAP_DAY_MS = 24 * 60 * 60 * 1000;

/** Paid history and pending claims share one allowance across every exam. */
export function recapAllowance(
  purchases: Date[], pendingExpiries: Date[], limit: number, days: number, now = new Date(),
) {
  const duration = days * RECAP_DAY_MS;
  const releases = [
    ...purchases.filter((at) => at.getTime() + duration > now.getTime()).map((at) => at.getTime() + duration),
    ...pendingExpiries.filter((at) => at > now).map((at) => at.getTime()),
  ].sort((a, b) => a - b);
  const used = releases.length;
  return {
    used,
    remaining: Math.max(0, limit - used),
    nextAvailableAt: limit > 0 && used >= limit
      ? new Date(releases[used - limit]!).toISOString() : null,
  };
}

export function recapMode(owned: boolean, premium: boolean, earned: boolean) {
  return owned ? "OWNED" : premium ? "PREMIUM" : earned ? "EARNED" : "COIN";
}

type TeaserSource = {
  rhythm: { activeDays: number; focusMinutes: number; subjectBreakdown: { subjectName: string; focusMinutes: number }[] };
  plan: { subjectBreakdown: { subjectName: string; completedTaskCount: number }[] };
};

/** The locked card's cover: free basic numbers only, never the story or its narration. */
export function recapTeaser({ rhythm, plan }: TeaserSource): WeeklyRecapTeaserDto {
  const top = <T>(rows: T[], by: (row: T) => number) => rows.reduce<T | undefined>((best, row) => !best || by(row) > by(best) ? row : best, undefined);
  const topSubject = top(rhythm.subjectBreakdown, (row) => row.focusMinutes)?.subjectName
    ?? top(plan.subjectBreakdown, (row) => row.completedTaskCount)?.subjectName ?? null;
  return { activeDays: rhythm.activeDays, focusMinutes: rhythm.focusMinutes, topSubject };
}
