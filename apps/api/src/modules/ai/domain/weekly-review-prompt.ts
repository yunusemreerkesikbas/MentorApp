import type {
  WeeklyRecapHighlightDto,
  WeeklyRecapTitleId,
  WeeklyReviewDto,
} from "@mentor/types";

export const WEEKLY_REVIEW_PROMPT_VERSION = "v7";

type WeeklyReviewEditorialFrame =
  | "ensemble"
  | "rhythm"
  | "depth"
  | "construction"
  | "discovery"
  | "courage"
  | "momentum";

const EDITORIAL_FRAME_BY_TITLE: Record<
  WeeklyRecapTitleId,
  WeeklyReviewEditorialFrame
> = {
  BALANCE_MASTER: "ensemble",
  RHYTHM_GUARDIAN: "rhythm",
  FOCUS_DIVER: "depth",
  PLAN_ARCHITECT: "construction",
  SUBJECT_EXPLORER: "discovery",
  MOCK_BRAVE: "courage",
  FOCUS_TRAVELER: "momentum",
};

export function buildWeeklyReviewNarrationEvidence(
  review: WeeklyReviewDto,
) {
  return {
    editorialFrame: review.recap.weeklyTitle
      ? EDITORIAL_FRAME_BY_TITLE[review.recap.weeklyTitle.id]
      : "momentum",
    weeklyTitle: review.recap.weeklyTitle,
    highlights: review.highlights.map(narrationHighlight),
    channels: {
      mockExamCount: review.evidence.mockExamCount,
      qualifyingSessionCount: review.evidence.qualifyingSessionCount,
      completedTaskCount: review.plan.completedTaskCount,
    },
    rhythm: {
      focusMinutes: review.rhythm.focusMinutes,
      activeDays: review.rhythm.activeDays,
      longestSessionMinutes: review.rhythm.longestSessionMinutes,
      longestActiveRun: review.rhythm.longestActiveRun,
      focusTimeBand: review.rhythm.focusTimeBand,
      peakFocusDay: review.rhythm.peakFocusDay,
      subjectBreakdown: review.rhythm.subjectBreakdown
        .slice(0, 3)
        .map(({ subjectName, focusMinutes, qualifyingSessionCount }) => ({
          subjectName,
          focusMinutes,
          qualifyingSessionCount,
        })),
    },
    plan: {
      completedTaskCount: review.plan.completedTaskCount,
      subjectBreakdown: review.plan.subjectBreakdown
        .slice(0, 3)
        .map(({ subjectName, completedTaskCount }) => ({
          subjectName,
          completedTaskCount,
        })),
    },
    performance: review.performance,
    nextStep: review.focus?.message ?? review.suggestedTask?.title ?? null,
  };
}

export function buildWeeklyReviewPrompt(
  review: WeeklyReviewDto,
  locale: string,
) {
  return {
    system: [
      "You are Puhu, Mentor's lively weekly recap host for exam preparation.",
      locale.startsWith("en") ? "Write in English." : "Türkçe yaz.",
      "Write exactly three short plain-text sentences as a three-beat Wrapped story.",
      "Beat 1: reveal. Introduce the supplied weekly character with a confident hook.",
      "Beat 2: proof. Interpret exactly one supplied highlight or rhythm fact.",
      "Beat 3: forward motion. Connect naturally to the supplied next step; if it is null, close with momentum without inventing advice.",
      "Use the supplied editorialFrame only as light imagery. Keep the wording vivid, specific, conversational, and varied.",
      "Avoid generic filler such as 'harika bir hafta', repeated 'bu hafta', therapy language, and exaggerated praise.",
      "The supplied weekly character, highlights, metrics, and next step are deterministic backend facts. Never select, replace, rename, rank, or contradict them.",
      "Never infer personal traits, diagnose, shame, solve questions, or invent official exam information.",
      "Use only the JSON evidence supplied. No markdown, no lists, no emojis, and at most one exclamation mark.",
      "Punctuation: period, comma, or colon. Never the em dash.",
    ].join("\n"),
    user: JSON.stringify(buildWeeklyReviewNarrationEvidence(review)),
  };
}

function narrationHighlight(highlight: WeeklyRecapHighlightDto) {
  switch (highlight.kind) {
    case "TOP_FOCUS_SUBJECT":
      return {
        kind: highlight.kind,
        subjectName: highlight.subjectName,
        focusMinutes: highlight.focusMinutes,
        message: highlight.message,
      };
    case "TOP_PLAN_SUBJECT":
      return {
        kind: highlight.kind,
        subjectName: highlight.subjectName,
        completedTaskCount: highlight.completedTaskCount,
        message: highlight.message,
      };
    default:
      return highlight;
  }
}
