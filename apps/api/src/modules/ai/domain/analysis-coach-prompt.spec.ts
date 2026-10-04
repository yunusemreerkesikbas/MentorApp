import { describe, expect, it } from "vitest";
import { analysisCoachPrompt } from "./analysis-coach-prompt";

describe("analysis coach aggregate projection", () => {
  it("discards extra private fields even when upstream objects contain them", () => {
    const context = {
      focus: { subjectName: "Math", source: "PHOTO_SIGNAL" as const, evidenceCount: 2, note: "SECRET_FOCUS_NOTE" },
      focusTrend: null,
      topics: [],
      cycle: null,
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

  it("projects the focus trend, repeated topics and loop progress without their extra fields", () => {
    const context = {
      focus: { subjectName: "Math", source: "PHOTO_SIGNAL" as const, evidenceCount: 5 },
      dominantError: null,
      notebookStats: { savedCount: 9, reviewedCount: 4, dueCount: 3, healedCount: 1 },
      focusTrend: { direction: "DOWN" as const, recentDelta: "-2.50", note: "SECRET_TREND" },
      topics: [
        { subjectName: "Math", topicName: "Problems", count: 5, storageKey: "SECRET_KEY" },
      ],
      cycle: { practiced: true, measured: false, closed: false, taskTitle: "SECRET_TASK" },
    };
    const prompt = analysisCoachPrompt(context);
    expect(prompt).toContain('"focusTrend":{"direction":"DOWN","recentDelta":"-2.50"}');
    expect(prompt).toContain('"topics":[{"subjectName":"Math","topicName":"Problems","count":5}]');
    expect(prompt).toContain('"cycle":{"practiced":true,"measured":false,"closed":false}');
    expect(prompt).toContain("the next step is the stage it is missing");
    expect(prompt).not.toContain("SECRET_");
  });
});
