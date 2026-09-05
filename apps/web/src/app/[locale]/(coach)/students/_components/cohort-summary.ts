import {
  MentorshipRiskFlag,
  type MentorshipRiskFlagId,
  type MentorshipRosterRowDto,
} from "@mentor/types";

/**
 * The roster answers "who needs me"; this answers "how is the group". Both come from the same
 * response — the page already loads every ACTIVE row (`pageSize=100` against a 20-student quota),
 * so the cohort view costs no request and needs no endpoint of its own.
 *
 * Roadmap §9 asks the panel to surface "kim geride, neden, ne yapmalı" on entry. The sorted list
 * was the first third; `flagCounts` is the second.
 */

/**
 * Display order, worst first — the same order the API's `risk-flags.ts` sorts by. It is duplicated
 * rather than shared because it crosses a package boundary for presentation only: if the two ever
 * drift, chips are reordered, nothing is miscounted.
 */
const FLAG_ORDER: readonly MentorshipRiskFlagId[] = [
  MentorshipRiskFlag.INACTIVE,
  MentorshipRiskFlag.LOW_MOOD,
  MentorshipRiskFlag.NET_DROP,
  MentorshipRiskFlag.PLAN_SLIPPING,
];

export interface CohortSummary {
  total: number;
  /** Students carrying at least one flag. */
  needsAttention: number;
  /** Non-zero counts only, worst first. A student with two flags is counted under both. */
  flagCounts: { flag: MentorshipRiskFlagId; count: number }[];
  /** 0..1 mean plan completion, or null when nobody in the cohort planned anything. */
  planAdherence: number | null;
  /** How many students the mean is built from. A mean over 2 of 20 is a different claim. */
  planAdherenceOf: number;
}

export function summarizeCohort(rows: readonly MentorshipRosterRowDto[]): CohortSummary {
  const counts = new Map<MentorshipRiskFlagId, number>();
  let needsAttention = 0;
  let adherenceSum = 0;
  let adherenceOf = 0;

  for (const row of rows) {
    if (row.riskFlags.length > 0) needsAttention += 1;
    for (const flag of row.riskFlags) counts.set(flag, (counts.get(flag) ?? 0) + 1);

    // A null rate means the student planned nothing. Counting that as 0% would let a cohort of
    // people who never opened the plan screen read as one that plans and fails — the module's
    // "absence of data is not evidence" rule, applied to the average instead of a flag.
    const rate = row.metrics?.planCompletionRate7d;
    if (rate !== null && rate !== undefined) {
      adherenceSum += rate;
      adherenceOf += 1;
    }
  }

  return {
    total: rows.length,
    needsAttention,
    flagCounts: FLAG_ORDER.filter((flag) => (counts.get(flag) ?? 0) > 0).map((flag) => ({
      flag,
      count: counts.get(flag) ?? 0,
    })),
    planAdherence: adherenceOf === 0 ? null : adherenceSum / adherenceOf,
    planAdherenceOf: adherenceOf,
  };
}

/**
 * The flag to act on first when a student carries several.
 *
 * Needed because the API returns flags in evaluation order, not severity order: `evaluateRiskFlags`
 * pushes PLAN_SLIPPING before LOW_MOOD, while severity ranks LOW_MOOD above it. `compareByRisk`
 * sorts rows, never the flags inside one, so "the worst flag on this student" has to be picked here.
 */
export function worstFlag(flags: readonly MentorshipRiskFlagId[]): MentorshipRiskFlagId | null {
  return FLAG_ORDER.find((flag) => flags.includes(flag)) ?? null;
}
