import type { WeeklyDeepAnalysisDto } from "@mentor/types";

type MetricId = WeeklyDeepAnalysisDto["metrics"][number]["id"];

/** The hero names one gain: steadier days read first, then time, then tasks. */
const VERDICT_METRICS: readonly MetricId[] = ["ACTIVE_DAYS", "FOCUS_MINUTES", "PLAN_TASKS"];

export interface WeeklyVerdict {
  metric: { id: MetricId; previous: number; current: number } | null;
  subject: { name: string; delta: number } | null;
}

/** Net strings arrive as "12.00" / "+2.00"; null stays null. */
export function parseNet(value: string | null): number | null {
  if (value === null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Picks the week's headline from the frozen snapshot: the first metric that rose against a
 * recorded previous week, and the subject with the largest rise. Display only, nothing scored.
 */
export function pickWeeklyVerdict(detail: WeeklyDeepAnalysisDto): WeeklyVerdict {
  let metric: WeeklyVerdict["metric"] = null;
  for (const id of VERDICT_METRICS) {
    const m = detail.metrics.find((x) => x.id === id);
    if (m && m.previous !== null && m.current > m.previous) {
      metric = { id, previous: m.previous, current: m.current };
      break;
    }
  }
  let subject: WeeklyVerdict["subject"] = null;
  for (const s of detail.subjects) {
    const delta = s.trend === "UP" ? parseNet(s.delta) : null;
    if (delta !== null && delta > 0 && (!subject || delta > subject.delta)) subject = { name: s.subjectName, delta };
  }
  return { metric, subject };
}
