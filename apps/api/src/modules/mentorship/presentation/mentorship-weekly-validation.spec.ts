import { describe, expect, it } from "vitest";
import {
  finalizeMentorshipWeeklyReportSchema,
  mentorshipWeeklyBriefSchema,
} from "@mentor/validation";

const source = { weekStart: "2026-08-31", sourceFingerprint: "a".repeat(64) };
describe("weekly preparation input", () => {
  it("accepts omitted, empty or 500 character context, trimming outer whitespace", () => {
    expect(mentorshipWeeklyBriefSchema.parse(source)).not.toHaveProperty(
      "coachContext",
    );
    expect(
      mentorshipWeeklyBriefSchema.parse({ ...source, coachContext: "  " })
        .coachContext,
    ).toBe("");
    expect(
      mentorshipWeeklyBriefSchema.parse({
        ...source,
        coachContext: ` ${"a".repeat(500)} `,
      }).coachContext,
    ).toHaveLength(500);
  });
  it("rejects too-long or non-string input", () => {
    expect(
      mentorshipWeeklyBriefSchema.safeParse({
        ...source,
        coachContext: "a".repeat(501),
      }).success,
    ).toBe(false);
    expect(
      mentorshipWeeklyBriefSchema.safeParse({ ...source, coachContext: {} })
        .success,
    ).toBe(false);
  });
  it("does not let finalization replace the preparation context", () => {
    const parsed = finalizeMentorshipWeeklyReportSchema.parse({
      ...source,
      operationId: "11111111-1111-4111-8111-111111111111",
      coachContext: "replacement",
    });
    expect(parsed).not.toHaveProperty("coachContext");
  });
});
