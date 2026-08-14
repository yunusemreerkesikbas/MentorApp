import { describe, expect, it } from "vitest";
import { createThreadSchema, pollVoteSchema } from "@mentor/validation";

const validPoll = {
  options: ["Sabah", "Akşam"],
  durationMinutes: 1_440,
};

describe("forum poll request contracts", () => {
  it("accepts a two-option poll with a valid duration", () => {
    expect(createThreadSchema.safeParse({ body: "Ne zaman çalışalım?", poll: validPoll }).success)
      .toBe(true);
  });

  it.each([
    { options: ["Tek"], durationMinutes: 1_440 },
    { options: ["1", "2", "3", "4", "5"], durationMinutes: 1_440 },
    { options: ["A", "a"], durationMinutes: 1_440 },
    { options: ["A", "B"], durationMinutes: 4 },
    { options: ["A", "B"], durationMinutes: 10_081 },
  ])("rejects invalid poll input %#", (poll) => {
    expect(createThreadSchema.safeParse({ body: "Soru", poll }).success).toBe(false);
  });

  it("rejects a poll combined with attachments", () => {
    expect(
      createThreadSchema.safeParse({
        body: "Soru",
        poll: validPoll,
        attachments: [{ key: "forum/u/a.png", mimeType: "image/png" }],
      }).success,
    ).toBe(false);
  });

  it("accepts only UUID option identifiers for votes", () => {
    expect(pollVoteSchema.safeParse({ optionId: "44c10b94-8f9a-49b0-8a9a-94f21a5ab434" }).success)
      .toBe(true);
    expect(pollVoteSchema.safeParse({ optionId: "not-an-option" }).success).toBe(false);
  });
});
