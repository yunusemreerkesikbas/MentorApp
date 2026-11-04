import type { WeeklyDeepAnalysisDto } from "@mentor/types";
import { formatNet, formatNetDelta, formatNetText } from "./net";

interface WeekSummary {
  focusMinutes: number;
  activeDays: number;
  completedTaskCount: number;
  mockExamCount: number;
}

interface SubjectEvidence {
  subjectRef: string;
  subjectName: string;
  currentNets: number[];
  previousNets: number[];
  focusMinutes: number;
  completedTaskCount: number;
}

interface DeepAnalysisInput {
  current: WeekSummary;
  previous: WeekSummary | null;
  subjects: SubjectEvidence[];
  translate: (key: string, args?: Record<string, unknown>) => string;
  /** Formats nets inside messages ("12 net", "-2 net"); DTO fields stay "12.00". */
  locale: string;
}

const average = (values: number[]) => values.length
  ? values.reduce((sum, value) => sum + value, 0) / values.length : null;

export function buildWeeklyDeepAnalysis({ current, previous, subjects, translate: t, locale }: DeepAnalysisInput): WeeklyDeepAnalysisDto {
  const metrics = ([
    ["FOCUS_MINUTES", "focusMinutes"], ["ACTIVE_DAYS", "activeDays"], ["PLAN_TASKS", "completedTaskCount"],
  ] as const).map(([id, key]) => ({
    id, current: current[key], previous: previous?.[key] ?? null,
    delta: previous ? current[key] - previous[key] : null,
    message: t(`DEEP_${id}_${previous ? "COMPARE" : "FIRST"}`, {
      current: current[key], previous: previous?.[key],
    }),
  }));
  const rows = subjects.filter((row) => row.currentNets.length || row.previousNets.length || row.focusMinutes || row.completedTaskCount)
    .map((row): WeeklyDeepAnalysisDto["subjects"][number] => {
      const net = average(row.currentNets), old = average(row.previousNets);
      const delta = net !== null && old !== null ? formatNetDelta(net - old) : null;
      const trend = net === null ? "NO_EXAM" : old === null ? "EARLY"
        : Number(delta) > 0 ? "UP" : Number(delta) < 0 ? "DOWN" : "STEADY";
      return {
        subjectRef: row.subjectRef, subjectName: row.subjectName,
        averageNet: net === null ? null : formatNet(net), previousAverageNet: old === null ? null : formatNet(old), delta,
        mockExamCount: row.currentNets.length, previousMockExamCount: row.previousNets.length,
        focusMinutes: row.focusMinutes, completedTaskCount: row.completedTaskCount, trend,
        message: t(`DEEP_SUBJECT_${trend}`, { subject: row.subjectName,
          net: net === null ? null : formatNetText(net, locale),
          delta: net !== null && old !== null ? formatNetText(net - old, locale, true) : null,
          count: row.currentNets.length, previousCount: row.previousNets.length }),
      };
    });
  return { metrics, subjects: rows, evidenceMessage: t(current.mockExamCount === 0 ? "DEEP_EVIDENCE_NO_EXAMS"
    : !previous?.mockExamCount ? "DEEP_EVIDENCE_EARLY" : "DEEP_EVIDENCE_COMPARABLE", {
      current: current.mockExamCount, previous: previous?.mockExamCount ?? 0,
    }) };
}
