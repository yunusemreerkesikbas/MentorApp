import type { ExamSubjectDto, MockExamTrendPointDto } from "@mentor/types";

export type AnalysisTab = "entry" | "progress" | "mistakes";

/** The two views the tabs switch between; `entry` is the form, opened from "Deneme ekle". */
export type AnalysisViewTab = Exclude<AnalysisTab, "entry">;

export interface SubjectScores {
  correct: string;
  wrong: string;
  blank: string;
  /** Typed by the student (or loaded from a saved exam); otherwise blank follows the other two. */
  blankManual: boolean;
}

/**
 * One field of a subject row changes. Blank fills itself in as questions − correct − wrong until the
 * student types into it; emptying it hands it back. It stays empty while either of the other two is
 * empty or they already exceed the questions, where the row's own error speaks.
 */
export function withScore(
  row: SubjectScores,
  field: "correct" | "wrong" | "blank",
  value: string,
  questionCount: number | null,
): SubjectScores {
  if (field === "blank") return { ...row, blank: value, blankManual: value !== "" };
  const next = { ...row, [field]: value };
  if (next.blankManual || questionCount == null) return next;
  const rest = questionCount - Number(next.correct) - Number(next.wrong);
  const known = next.correct !== "" && next.wrong !== "";
  return { ...next, blank: known && rest >= 0 ? String(rest) : "" };
}

const TAB_VALUES: AnalysisTab[] = ["entry", "progress", "mistakes"];

export function parseAnalysisTab(value: string | null): AnalysisTab {
  if (value && TAB_VALUES.includes(value as AnalysisTab)) {
    return value as AnalysisTab;
  }
  return "progress";
}

export function shouldNavigateAnalysisTab(
  current: AnalysisTab,
  next: AnalysisTab,
): boolean {
  return current !== next;
}

export function buildAnalysisCoachHref(seed: string, contextMockExamId?: string) {
  return {
    pathname: "/coach/chat" as const,
    query: { seed, ...(contextMockExamId && { contextMockExamId }) },
  };
}

export function buildAnalysisTabHref(
  pathname: string,
  search: string,
  tab: AnalysisTab,
): string {
  const params = new URLSearchParams(search);
  params.set("tab", tab);
  params.delete("_rsc");
  return `${pathname}?${params.toString()}`;
}

/** Paper sections only — catch-all `diger` has no questionCount and is not a deneme row. */
export function paperSubjects(subjects: ExamSubjectDto[]): ExamSubjectDto[] {
  return subjects.filter((subject) => subject.questionCount != null);
}

export function emptyScores(
  subjects: ExamSubjectDto[],
): Record<string, SubjectScores> {
  return Object.fromEntries(
    paperSubjects(subjects).map((subject) => [
      subject.slug,
      { correct: "", wrong: "", blank: "", blankManual: false },
    ]),
  );
}

export function scoresFromMockExam(
  subjects: ExamSubjectDto[],
  rows: { subjectRef: string; correct: number; wrong: number; blank: number }[],
): Record<string, SubjectScores> {
  const byRef = new Map(rows.map((row) => [row.subjectRef, row]));
  return Object.fromEntries(
    paperSubjects(subjects).map((subject) => {
      const row = byRef.get(subject.slug);
      return [
        subject.slug,
        {
          correct: row ? String(row.correct) : "",
          wrong: row ? String(row.wrong) : "",
          blank: row ? String(row.blank) : "",
          // A stored blank is what the student entered; it is not recomputed under them.
          blankManual: Boolean(row),
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

/** Axis and node label: "10 Ağu". */
export function formatShortDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "short" });
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
