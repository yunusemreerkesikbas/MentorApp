/**
 * "Which signals have I already told someone about?"
 *
 * The unit is a `studentId:FLAG` pair, and everything that decides whether a coach is being told
 * something NEW reduces to comparing two sets of them. Two surfaces need that answer and they are
 * not allowed to disagree: the 07:00 risk digest decides whether an email goes out at all, and the
 * cohort brief decides which of its lines wear the "new" badge. A coach who was emailed about a
 * student last night and opens the panel this morning must not be told it is news again.
 *
 * This is `attention.ts` said one level up — that file keeps the panel and the email agreeing about
 * what "handled" means, this one keeps them agreeing about what "new" means. Both live in the
 * domain, pure, so neither caller owns the rule.
 */

/** A student and the flags currently firing for them. Both callers already hold this shape. */
export interface RiskFlagCarrier {
  studentId: string;
  flags: readonly string[];
}

/**
 * The flattened, sorted pair set. Sorted because it is persisted and compared as an array, and an
 * order that depends on query results would make two identical situations look different.
 */
export function toRiskPairs(carriers: readonly RiskFlagCarrier[]): string[] {
  return carriers
    .flatMap((carrier) => carrier.flags.map((flag) => `${carrier.studentId}:${flag}`))
    .sort();
}

/** True when `pairs` carries at least one thing `baseline` did not. */
export function hasNewPairs(
  pairs: readonly string[],
  baseline: ReadonlySet<string>,
): boolean {
  return pairs.some((pair) => !baseline.has(pair));
}

/**
 * Per-student version of {@link hasNewPairs} — the same question asked one row at a time, which is
 * what a screen needs and an email does not.
 *
 * A student with no flags is never "new": there is nothing to report about them, and the cohort
 * brief does not list them in the first place.
 */
export function isNewForStudent(
  carrier: RiskFlagCarrier,
  baseline: ReadonlySet<string>,
): boolean {
  return hasNewPairs(toRiskPairs([carrier]), baseline);
}
