import { MentorshipRiskFlag, type MentorshipRiskFlagId } from "@mentor/types";

/**
 * Display order, worst first: the order the API's `risk-flags.ts` sorts rows by. Duplicated rather
 * than shared because it crosses a package boundary for presentation only; if the two ever drift,
 * pills are reordered and nothing is miscounted.
 */
const FLAG_ORDER: readonly MentorshipRiskFlagId[] = [
  MentorshipRiskFlag.INACTIVE,
  MentorshipRiskFlag.LOW_MOOD,
  MentorshipRiskFlag.NET_DROP,
  MentorshipRiskFlag.PLAN_SLIPPING,
];

/**
 * The flag to act on first when a student carries several. The API already sends a row's flags
 * worst first; reading them through `FLAG_ORDER` keeps the pick right if the two orders drift.
 */
export function worstFlag(flags: readonly MentorshipRiskFlagId[]): MentorshipRiskFlagId | null {
  return FLAG_ORDER.find((flag) => flags.includes(flag)) ?? null;
}

/** A student's flags, worst first. */
export function sortFlags(flags: readonly MentorshipRiskFlagId[]): MentorshipRiskFlagId[] {
  return FLAG_ORDER.filter((flag) => flags.includes(flag));
}
