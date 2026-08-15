/**
 * Reads a mistake-notebook error-type distribution and picks the one sentence worth saying.
 *
 * A rule engine, not an LLM, and that is a cost decision as much as a guardrail one: this runs on
 * every analysis load, the input is six integers, and there is no judgement here a model would make
 * better than a threshold.
 *
 * The tone rule bites here (§0): every outcome has to be actionable and none may read as a verdict
 * on the student. "Your hand is rushing" is a thing to fix; "you are careless" is an insult.
 */

export interface ErrorTypeCount {
  errorType: string;
  count: number;
}

/** Below this there is no pattern, only noise, and inventing one costs the reader their trust. */
export const MIN_ENTRIES_FOR_PATTERN = 5;

/** A type has to own this much of the distribution before it is "the" pattern rather than a tie. */
const DOMINANCE = 0.4;

export type ErrorPatternId =
  | "KNOWLEDGE_GAP"
  | "RUSHING"
  | "READING"
  | "DISTRACTOR"
  | "TIME_PRESSURE"
  | "SECOND_GUESSING"
  | "MIXED";

const PATTERN_BY_TYPE: Record<string, ErrorPatternId> = {
  UNKNOWN_TOPIC: "KNOWLEDGE_GAP",
  CARELESS: "RUSHING",
  MISREAD: "READING",
  DISTRACTOR: "DISTRACTOR",
  TIME: "TIME_PRESSURE",
  CHANGED_ANSWER: "SECOND_GUESSING",
};

/**
 * `null` means "say nothing" — a deliberate outcome, not a missing branch. An analysis screen that
 * always has an opinion trains the reader to ignore it.
 */
export function selectErrorPattern(
  signals: ErrorTypeCount[],
): ErrorPatternId | null {
  const total = signals.reduce((sum, signal) => sum + signal.count, 0);
  if (total < MIN_ENTRIES_FOR_PATTERN) return null;

  const top = signals.reduce((best, signal) =>
    signal.count > best.count ? signal : best,
  );
  if (top.count / total < DOMINANCE) return "MIXED";
  return PATTERN_BY_TYPE[top.errorType] ?? "MIXED";
}
