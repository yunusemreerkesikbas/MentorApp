import { MentorshipRiskFlag, type MentorshipRiskFlagId } from "@mentor/types";
import type { CohortStudentSnapshot } from "../../coaching/domain/cohort-evidence";

/**
 * Rule-based triage — deliberately not AI (roadmap §9 calls the AI brief a later layer, and a
 * coach acting on a hallucinated "this student is struggling" is worse than no signal at all).
 *
 * Each flag answers a question a coach would otherwise scan the roster for by hand. Thresholds are
 * config so they can be calibrated from live data without a deploy; the rules themselves are here,
 * pure and testable.
 *
 * Only the domain type crosses from coaching — `CohortStudentSnapshot` is an aggregate contract,
 * not a table read, so this stays inside the workstream boundary.
 */
export interface RiskThresholds {
  inactiveDays: number;
  planCompletionFloor: number;
  lowMoodCeiling: number;
}

/** Ordered worst-first; the roster sorts by the first flag's weight. */
const SEVERITY: MentorshipRiskFlagId[] = [
  MentorshipRiskFlag.INACTIVE,
  MentorshipRiskFlag.LOW_MOOD,
  MentorshipRiskFlag.NET_DROP,
  MentorshipRiskFlag.PLAN_SLIPPING,
];

export function evaluateRiskFlags(
  snapshot: CohortStudentSnapshot,
  thresholds: RiskThresholds,
  today: string,
): MentorshipRiskFlagId[] {
  const flags: MentorshipRiskFlagId[] = [];

  // A student who has never been active is not "inactive for 0 days" — they never started.
  // Both cases deserve the flag, so a null last-active counts as inactive.
  const idleDays =
    snapshot.lastActiveDate === null
      ? Number.POSITIVE_INFINITY
      : daysBetweenIso(snapshot.lastActiveDate, today);
  if (idleDays > thresholds.inactiveDays) flags.push(MentorshipRiskFlag.INACTIVE);

  // Null completion means nothing was planned — silence, not failure. Don't flag it here;
  // an inactive student with no plan is already caught above.
  if (
    snapshot.planCompletionRate7d !== null &&
    snapshot.planCompletionRate7d < thresholds.planCompletionFloor
  ) {
    flags.push(MentorshipRiskFlag.PLAN_SLIPPING);
  }

  if (
    snapshot.moodLevel7dAvg !== null &&
    snapshot.moodLevel7dAvg <= thresholds.lowMoodCeiling
  ) {
    flags.push(MentorshipRiskFlag.LOW_MOOD);
  }

  // Strictly below the baseline — an identical net is holding steady, not slipping.
  if (
    snapshot.latestMockNet !== null &&
    snapshot.previousMockNetAvg !== null &&
    snapshot.latestMockNet < snapshot.previousMockNetAvg
  ) {
    flags.push(MentorshipRiskFlag.NET_DROP);
  }

  return SEVERITY.filter((flag) => flags.includes(flag));
}

/**
 * Roster ordering: students who need attention first. Ties break on staleness, so within the same
 * severity the coach sees whoever has been quiet longest.
 */
export function compareByRisk(
  a: { riskFlags: MentorshipRiskFlagId[]; lastActiveDate: string | null },
  b: { riskFlags: MentorshipRiskFlagId[]; lastActiveDate: string | null },
): number {
  const weight = (flags: MentorshipRiskFlagId[]): number =>
    flags.length === 0 ? SEVERITY.length : SEVERITY.indexOf(flags[0]!);
  const byWeight = weight(a.riskFlags) - weight(b.riskFlags);
  if (byWeight !== 0) return byWeight;
  // null (never active) sorts first — the student who never started needs the coach most.
  if (a.lastActiveDate === b.lastActiveDate) return 0;
  if (a.lastActiveDate === null) return -1;
  if (b.lastActiveDate === null) return 1;
  return a.lastActiveDate < b.lastActiveDate ? -1 : 1;
}

/** Whole days between two `yyyy-mm-dd` strings. UTC, matching the rest of coaching's day math. */
function daysBetweenIso(from: string, to: string): number {
  const ms = Date.parse(`${to}T00:00:00.000Z`) - Date.parse(`${from}T00:00:00.000Z`);
  return Math.round(ms / 86_400_000);
}
