import { describe, expect, it } from "vitest";
import { analysisCoachPrompt } from "./analysis-coach-prompt";

describe("analysis coach aggregate projection", () => {
  it("discards extra private fields even when upstream objects contain them", () => {
    const context = {
      focus: { subjectName: "Math", source: "PHOTO_SIGNAL" as const, evidenceCount: 2, note: "SECRET_FOCUS_NOTE" },
      dominantError: { errorType: "UNKNOWN_TOPIC" as const, count: 2, sharePercent: 100, confession: "SECRET_CONFESSION" },
      notebookStats: { savedCount: 2, reviewedCount: 1, dueCount: 1, healedCount: 0, storageKey: "SECRET_PHOTO_KEY" },
      solutionNote: "SECRET_SOLUTION",
    };
    const prompt = analysisCoachPrompt(context);
    expect(prompt).toContain('"savedCount":2');
    expect(prompt).toContain('"subjectName":"Math"');
    expect(prompt).not.toContain("SECRET_");
    expect(prompt).toContain("Do not emit TASK markers");
  });
});
