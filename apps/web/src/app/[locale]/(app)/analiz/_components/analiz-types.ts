import type {
  ExamSubjectDto,
  MockExamTrendPointDto,
} from "@mentor/types";

export type AnalizTab = "gir" | "gelisim" | "yanlislar";

export type TrendWindow = "4" | "8" | "12";

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

export function shouldNavigateAnalizTab(
  current: AnalizTab,
  next: AnalizTab,
): boolean {
  return current !== next;
}

export function shouldRevealFirstInsight(attemptCount: number): boolean {
  return attemptCount === 0;
}

export function buildAnalizTabHref(
  pathname: string,
  search: string,
  tab: AnalizTab,
): string {
  const params = new URLSearchParams(search);
  params.set("tab", tab);
  params.delete("_rsc");
  return `${pathname}?${params.toString()}`;
}

export function emptyScores(
  subjects: ExamSubjectDto[],
): Record<string, SubjectScores> {
  return Object.fromEntries(
    subjects.map((subject) => [
      subject.slug,
      { correct: "", wrong: "", blank: "" },
    ]),
  );
}

export function scoresFromMockExam(
  subjects: ExamSubjectDto[],
  rows: { subjectRef: string; correct: number; wrong: number; blank: number }[],
): Record<string, SubjectScores> {
  const byRef = new Map(rows.map((row) => [row.subjectRef, row]));
  return Object.fromEntries(
    subjects.map((subject) => {
      const row = byRef.get(subject.slug);
      return [
        subject.slug,
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
  return trend.slice(0, Number(window));
}

/** Sparkline reads oldest → newest (left to right). */
export function trendForSparkline(
  trend: MockExamTrendPointDto[],
): MockExamTrendPointDto[] {
  return [...trend].reverse();
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
  for (const subject of subjects) {
    const row = scores[subject.slug];
    if (!row || subject.questionCount == null) continue;
    const total = subjectTotal(row);
    if (total > subject.questionCount) {
      return subject.slug;
    }
  }
  return null;
}




