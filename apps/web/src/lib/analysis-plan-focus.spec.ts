import { describe, expect, it, vi } from "vitest";
vi.mock("@mentor/api-client", () => ({
  contentControllerListExams: vi.fn(async () => [{ id: "exam", slug: "exam-slug" }]),
  contentControllerSubjectsBySlug: vi.fn(async () => [{ slug: "math", name: "Verified math" }]),
  contentControllerTopicsBySlug: vi.fn(async () => [{ subjectSlug: "math", slug: "topic", name: "Verified topic" }]),
}));
import { loadAnalysisPlanFocus, validAnalysisTaskDate } from "./analysis-plan-focus";
describe("analysis plan focus", () => {
  it("resolves names from the requested exam taxonomy", async () => {
    await expect(loadAnalysisPlanFocus({ examId: "exam", subjectRef: "math", topicRef: "topic" })).resolves.toEqual({ subjectName: "Verified math", topicName: "Verified topic" });
  });
  it("rejects a topic outside the subject", async () => {
    await expect(loadAnalysisPlanFocus({ examId: "exam", subjectRef: "math", topicRef: "foreign" })).rejects.toThrow("ANALYSIS_FOCUS_CHANGED");
  });
  it.each([undefined, "", "2026-02-30", "2026-01-01", "garbage"])("rejects invalid or past date %s", (value) => {
    expect(validAnalysisTaskDate(value, "2026-02-01")).toBe(false);
  });
  it("accepts a valid chosen date", () => expect(validAnalysisTaskDate("2026-02-28", "2026-02-01")).toBe(true));
});
