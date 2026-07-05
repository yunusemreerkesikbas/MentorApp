import type {
  CoachingAnalysisDto,
  ExamSubjectDto,
  GhostComparisonDto,
  MockExamTrendPointDto,
  SubjectStrengthDto,
} from "@mentor/types";

export type AnalizTab = "gir" | "gelisim" | "yanlislar";

export type TrendWindow = "4" | "8" | "all";

export interface SubjectScores {
  correct: string;
  wrong: string;
  blank: string;
}

const TAB_VALUES: AnalizTab[] = ["gir", "gelisim", "yanlislar"];

export function parseAnalizTab(value: string | null): AnalizTab {
  if (value && TAB_VALUES.includes(value as AnalizTab)) {
    return value as AnalizTab;
  }
  return "gir";
}

export function emptyScores(
  subjects: ExamSubjectDto[],
): Record<string, SubjectScores> {
  return Object.fromEntries(
    subjects.map((s) => [s.slug, { correct: "", wrong: "", blank: "" }]),
  );
}

export function scoresFromMockExam(
  subjects: ExamSubjectDto[],
  rows: { subjectRef: string; correct: number; wrong: number; blank: number }[],
): Record<string, SubjectScores> {
  const byRef = new Map(rows.map((r) => [r.subjectRef, r]));
  return Object.fromEntries(
    subjects.map((s) => {
      const row = byRef.get(s.slug);
      return [
        s.slug,
        {
          correct: row ? String(row.correct) : "",
          wrong: row ? String(row.wrong) : "",
          blank: row ? String(row.blank) : "",
        },
      ];
    }),
  );
}

export function formatTrendDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function sliceTrend(
  trend: MockExamTrendPointDto[],
  window: TrendWindow,
): MockExamTrendPointDto[] {
  if (window === "all") return trend;
  const n = window === "4" ? 4 : 8;
  return trend.slice(0, n);
}

/** Sparkline reads oldest → newest (left to right). */
export function trendForSparkline(
  trend: MockExamTrendPointDto[],
): MockExamTrendPointDto[] {
  return [...trend].reverse();
}

export function computePersonalRecordNet(
  analysis: CoachingAnalysisDto | null,
  personalRecordNet?: string | null,
): number | null {
  const fromApi = personalRecordNet ?? analysis?.personalRecordNet ?? null;
  if (fromApi != null) return Number(fromApi);
  if (!analysis?.trend.length) return null;
  const ghost = analysis.ghost;
  if (ghost) {
    return ghost.isNewRecord
      ? Number(ghost.latest.totalNet)
      : Number(ghost.bestPreviousNet);
  }
  return Math.max(...analysis.trend.map((p) => Number(p.totalNet)));
}

export function findWeakestSubject(
  subjects: SubjectStrengthDto[],
): SubjectStrengthDto | null {
  if (subjects.length === 0) return null;
  return subjects.reduce((min, s) =>
    Number(s.averageNet) < Number(min.averageNet) ? s : min,
  );
}

export function subjectTotal(scores: SubjectScores): number {
  return (
    Number(scores.correct || 0) +
    Number(scores.wrong || 0) +
    Number(scores.blank || 0)
  );
}

export function validateSubjectCounts(
  subjects: ExamSubjectDto[],
  scores: Record<string, SubjectScores>,
): string | null {
  for (const s of subjects) {
    const row = scores[s.slug];
    if (!row || s.questionCount == null) continue;
    const total = subjectTotal(row);
    if (total > s.questionCount) {
      return s.slug;
    }
  }
  return null;
}

export function ghostDeltaLabel(ghost: GhostComparisonDto): string {
  return ghost.previousDelta;
}
