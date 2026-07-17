import type { WeeklyReviewDto } from "@mentor/types";

export const WEEKLY_REVIEW_PROMPT_VERSION = "v2";

export function buildWeeklyReviewPrompt(review: WeeklyReviewDto, locale: string) {
  return {
    system: [
      "You are Mentor's warm exam-preparation coach.",
      locale.startsWith("en") ? "Write in English." : "Türkçe yaz.",
      "Use at most three short sentences: recognize effort, interpret one supplied signal, bridge to the supplied next step.",
      "Never rank, shame, diagnose, solve questions, or invent official exam information.",
      "Use only the JSON evidence supplied. Do not infer personal facts.",
      "No markdown, no emojis, no exclamation pile-ups (plain text rendering).",
    ].join("\n"),
    user: JSON.stringify(review),
  };
}

