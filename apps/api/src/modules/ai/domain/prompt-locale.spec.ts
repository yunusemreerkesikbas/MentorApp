import { describe, expect, it } from "vitest";
import type { CoachContext } from "./ai.constants";
import {
  buildDailyGreetingPrompt,
  buildGhostPrompt,
  buildMoodReflectionPrompt,
  buildPlanDraftPrompt,
  buildSessionReflectionPrompt,
  buildSystemPrompt,
  buildVisionNotePrompt,
} from "./ai.constants";
import { buildPlanAdaptationPrompt } from "./plan-adaptation";

const context: CoachContext = {
  examType: "KPSS",
  moodLevel: 3,
  recentSessions: null,
  todayPlan: null,
} as CoachContext;

describe("AI prompt locale", () => {
  it("requests English output from every prompt family", () => {
    const prompts = [
      { system: buildSystemPrompt(context, [], undefined, "en") },
      buildDailyGreetingPrompt(context, "en"),
      buildMoodReflectionPrompt(context, 3, "en"),
      buildPlanDraftPrompt(context, undefined, "2026-07-22", "en"),
      buildSessionReflectionPrompt(
        context,
        { subject: "Math", focusMinutes: 25, sessionMood: 2 },
        "en",
      ),
      buildGhostPrompt(
        {
          latest: { id: "m2", takenAt: "2026-07-22", totalNet: "60", examName: "KPSS" },
          previousNet: "55",
          previousDelta: "+5",
          beatPrevious: true,
          bestPreviousNet: "58",
          recordDelta: "+2",
          isNewRecord: true,
          headline: "Progress",
          subjects: [],
          aiNarration: null,
        },
        "en",
      ),
      buildVisionNotePrompt(
        context,
        {
          goalTitle: "Become a teacher",
          cityName: null,
          universityName: null,
          titleName: null,
          institutionName: null,
          careerLabel: null,
          motivation: null,
        },
        "en",
      ),
      buildPlanAdaptationPrompt({
        source: "PLAN",
        todayIso: "2026-07-22",
        examType: "KPSS",
        recentSummary: null,
        tasks: [],
        locale: "en",
      }),
    ];

    for (const prompt of prompts) {
      expect(prompt.system).toContain("Write the response in English.");
    }
  });

  it("defaults unsupported languages to Turkish", async () => {
    const { promptLocale, promptLanguageInstruction } = await import("./prompt-locale");

    expect(promptLocale("en-US")).toBe("en");
    expect(promptLocale("de-DE")).toBe("tr");
    expect(promptLanguageInstruction("tr")).toContain("Türkçe");
  });
});
