/**
 * Pure net-scoring logic (W2-b critical domain — framework-free).
 * KPSS default: net = correct − wrong / divisor (4 wrong = −1 correct).
 * The divisor comes from the exam's editorial net_rule — never a magic number here.
 */

export interface NetRule {
  kind: string;
  divisor: number;
}

export interface SubjectScoreInput {
  correct: number;
  wrong: number;
  blank: number;
}

/**
 * Compute net for one subject from D/Y/Boş and the exam's net_rule.
 * Note: a per-subject net is intentionally NOT floored at 0 — ÖSYM lets a negative subject net
 * reduce the total score (editorial decision); clamping would overstate the total.
 */
export function computeSubjectNet(input: SubjectScoreInput, rule: NetRule): number {
  if (rule.kind === "PENALTY") {
    return input.correct - input.wrong / rule.divisor;
  }
  throw new Error(`Unsupported net rule kind: ${rule.kind}`);
}

/** Sum per-subject nets into total net (two decimal places). */
export function computeTotalNet(subjectNets: number[]): number {
  const sum = subjectNets.reduce((acc, n) => acc + n, 0);
  return Math.round(sum * 100) / 100;
}

/** Format a net value for API transport (numeric column → string). */
export function formatNet(value: number): string {
  return value.toFixed(2);
}

/**
 * Format a signed net delta for display (e.g. "+3.25", "-1.50", "0.00"). Rounds to 2 decimals first
 * to drop float artifacts. Positive values get an explicit "+"; zero is unsigned.
 */
export function formatNetDelta(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return rounded > 0 ? `+${rounded.toFixed(2)}` : rounded.toFixed(2);
}
