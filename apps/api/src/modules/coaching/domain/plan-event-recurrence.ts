export type PlanEventRecurrenceReason =
  | "END_BEFORE_START"
  | "TOO_LONG"
  | "TOO_MANY_OCCURRENCES";

export class PlanEventRecurrenceError extends Error {
  constructor(readonly reason: PlanEventRecurrenceReason) {
    super(reason);
    this.name = "PlanEventRecurrenceError";
  }
}

export interface PlanEventRecurrenceRule {
  frequency: "DAILY" | "WEEKLY" | "MONTHLY";
  startsOn: string;
  end:
    | { kind: "DATE"; date: string }
    | { kind: "COUNT"; count: number };
}

const MAX_OCCURRENCES = 100;
const MAX_MONTHS = 12;
const DAY_MS = 86_400_000;

function parseDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function formatDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function addDays(value: Date, days: number): Date {
  return new Date(value.getTime() + days * DAY_MS);
}

/** Adds calendar months from the original day, clamping only the target month. */
function addAnchoredMonths(start: Date, months: number): Date {
  const year = start.getUTCFullYear();
  const month = start.getUTCMonth() + months;
  const targetYear = year + Math.floor(month / 12);
  const targetMonth = ((month % 12) + 12) % 12;
  const monthEnd = new Date(
    Date.UTC(targetYear, targetMonth + 1, 0),
  ).getUTCDate();
  return new Date(
    Date.UTC(targetYear, targetMonth, Math.min(start.getUTCDate(), monthEnd)),
  );
}

function occurrenceAt(
  start: Date,
  frequency: PlanEventRecurrenceRule["frequency"],
  index: number,
): Date {
  if (frequency === "DAILY") return addDays(start, index);
  if (frequency === "WEEKLY") return addDays(start, index * 7);
  return addAnchoredMonths(start, index);
}

/**
 * Expands a recurrence into inclusive ISO dates. It is deliberately pure and uses UTC only as
 * calendar arithmetic storage; event times remain Europe/Istanbul wall-clock values.
 */
export function generatePlanEventDates(
  rule: PlanEventRecurrenceRule,
): string[] {
  const start = parseDate(rule.startsOn);
  const maxDate = addAnchoredMonths(start, MAX_MONTHS);
  if (rule.end.kind === "COUNT" && rule.end.count > MAX_OCCURRENCES) {
    throw new PlanEventRecurrenceError("TOO_MANY_OCCURRENCES");
  }
  if (rule.end.kind === "DATE") {
    const end = parseDate(rule.end.date);
    if (end < start) throw new PlanEventRecurrenceError("END_BEFORE_START");
    if (end > maxDate) throw new PlanEventRecurrenceError("TOO_LONG");
  }

  const dates: string[] = [];
  for (let index = 0; ; index += 1) {
    const occurrence = occurrenceAt(start, rule.frequency, index);
    if (
      rule.end.kind === "COUNT" &&
      index >= rule.end.count
    ) {
      break;
    }
    if (
      rule.end.kind === "DATE" &&
      formatDate(occurrence) > rule.end.date
    ) {
      break;
    }
    if (occurrence > maxDate) {
      throw new PlanEventRecurrenceError("TOO_LONG");
    }
    if (dates.length >= MAX_OCCURRENCES) {
      throw new PlanEventRecurrenceError("TOO_MANY_OCCURRENCES");
    }
    dates.push(formatDate(occurrence));
  }
  return dates;
}
