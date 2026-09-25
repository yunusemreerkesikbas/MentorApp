import { todayInIstanbul } from "@/lib/date-time";

/**
 * The coach's "İlgilendim" mark, read the one way the server reads it.
 *
 * `needsAttention` is decided on the server (flagged, and not covered by a recent mark taken over
 * the same flags), because the morning digest applies the same rule. The toggle follows it rather
 * than `attendedAt`: a mark that went stale, past its TTL or overtaken by a new flag, is not a
 * handled student, and offering "undo" for it would ask the coach to take back something they
 * never saw.
 */
export function isAttended(row: {
  needsAttention: boolean;
  attendedAt: string | null;
}): boolean {
  return !row.needsAttention && row.attendedAt !== null;
}

/** Whole Istanbul days from the mark's day to `today` (Istanbul `yyyy-mm-dd`): 0 means today. */
export function daysSinceMark(attendedAt: string, today: string): number {
  const markDay = todayInIstanbul(new Date(attendedAt));
  return Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${markDay}T00:00:00Z`)) / 86_400_000);
}

/** The optimistic row after the coach marks, or takes back, their mark. */
export function withAttention<
  T extends { riskFlags: readonly unknown[]; attendedAt: string | null; needsAttention: boolean },
>(row: T, attended: boolean, now = new Date()): T {
  return {
    ...row,
    attendedAt: attended ? now.toISOString() : null,
    // Taking the mark back returns a flagged student to the queue; a calm one never was in it.
    needsAttention: !attended && row.riskFlags.length > 0,
  };
}
