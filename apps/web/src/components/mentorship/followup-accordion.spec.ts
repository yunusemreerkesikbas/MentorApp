import { describe, expect, it } from "vitest";
import { openFollowupId } from "./followup-accordion";

const page = [
  { id: "done", status: "COMPLETED" as const },
  { id: "first-open", status: "OPEN" as const },
  { id: "second-open", status: "OPEN" as const },
];

describe("which follow-up the panel shows open", () => {
  it("opens the first open record on the page until the coach chooses", () => {
    expect(openFollowupId(page, undefined)).toBe("first-open");
  });

  it("opens nothing when no record on the page is open", () => {
    expect(openFollowupId([{ id: "done", status: "COMPLETED" as const }], undefined)).toBeNull();
  });

  it("keeps the record the coach opened, a closed one included", () => {
    expect(openFollowupId(page, "second-open")).toBe("second-open");
    expect(openFollowupId(page, "done")).toBe("done");
  });

  it("stays closed once the coach closes it", () => {
    expect(openFollowupId(page, null)).toBeNull();
  });

  it("falls back to the first open record when the choice is not on this page", () => {
    expect(openFollowupId(page, "on-another-page")).toBe("first-open");
  });
});
