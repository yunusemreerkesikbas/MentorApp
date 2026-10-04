/**
 * The coach's round, carried from the roster to the report so its header can say "Sıradaki: Ali ›".
 *
 * `sessionStorage`, on purpose: the round is today's walk in this tab. A report opened from a link,
 * a notification or another tab has no round behind it, and then the header says nothing rather
 * than inventing an order.
 */
export interface RoundStop {
  studentId: string;
  name: string;
}

export type RoundNext = { kind: "next"; studentId: string; name: string } | { kind: "complete" };

const KEY = "mentor.coach-round";

export function parseRoundOrder(raw: string | null): RoundStop[] | null {
  if (raw === null) return null;
  try {
    const value: unknown = JSON.parse(raw);
    const valid =
      Array.isArray(value) &&
      value.every(
        (stop) =>
          typeof stop === "object" &&
          stop !== null &&
          typeof (stop as RoundStop).studentId === "string" &&
          typeof (stop as RoundStop).name === "string",
      );
    return valid ? (value as RoundStop[]) : null;
  } catch {
    return null;
  }
}

export function saveRoundOrder(stops: readonly RoundStop[]): void {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(stops));
  } catch {
    /* Private mode or a full quota: the report simply shows no "Sıradaki". */
  }
}

/**
 * The order as stored, unparsed: a string is a stable `useSyncExternalStore` snapshot, where a
 * freshly parsed array would be a new value on every read.
 */
export function readRoundOrderRaw(): string | null {
  try {
    return window.sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/** The stop after `studentId`, "complete" on the last one, null when this report is not on the round. */
export function nextInRound(
  stops: readonly RoundStop[] | null,
  studentId: string,
): RoundNext | null {
  const index = stops?.findIndex((stop) => stop.studentId === studentId) ?? -1;
  if (!stops || index === -1) return null;
  const next = stops[index + 1];
  return next ? { kind: "next", studentId: next.studentId, name: next.name } : { kind: "complete" };
}
