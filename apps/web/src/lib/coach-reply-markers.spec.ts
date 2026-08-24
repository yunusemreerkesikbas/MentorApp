import { describe, expect, it } from "vitest";
import { recoverSuggestedTask, sanitizeCoachDisplayText } from "./coach-reply-markers";

describe("sanitizeCoachDisplayText", () => {
  it("returns plain text untouched", () => {
    expect(sanitizeCoachDisplayText("Tebrikler, ritmin güzel.")).toBe(
      "Tebrikler, ritmin güzel.",
    );
  });

  it("strips a leaked malformed TASK (live session reflection)", () => {
    expect(
      sanitizeCoachDisplayText(
        'Tebrikler, ritmin güzel.\n<<TASK{"title":"mola teknikleri","subject":""}}',
      ),
    ).toBe("Tebrikler, ritmin güzel.");
  });
});

describe("recoverSuggestedTask", () => {
  it("recovers a title from a malformed TASK marker", () => {
    expect(
      recoverSuggestedTask('Not.\n<<TASK{"title":"mola teknikleri","subject":""}}'),
    ).toEqual({ title: "mola teknikleri", subject: null });
  });

  it("returns null when there is no marker", () => {
    expect(recoverSuggestedTask("Sade bir not.")).toBeNull();
  });
});
