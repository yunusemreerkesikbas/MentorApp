import { describe, expect, it } from "vitest";
import { MentorshipRiskFlag } from "@mentor/types";
import { sortFlags, worstFlag } from "./flag-order";

describe("worstFlag", () => {
  it("picks by severity, not by the order the API evaluated them in", () => {
    expect(
      worstFlag([MentorshipRiskFlag.PLAN_SLIPPING, MentorshipRiskFlag.LOW_MOOD]),
    ).toBe(MentorshipRiskFlag.LOW_MOOD);
  });

  it("has nothing to say about a calm student", () => {
    expect(worstFlag([])).toBeNull();
  });
});

describe("sortFlags", () => {
  it("orders a student's flags worst first", () => {
    expect(
      sortFlags([
        MentorshipRiskFlag.PLAN_SLIPPING,
        MentorshipRiskFlag.INACTIVE,
        MentorshipRiskFlag.NET_DROP,
      ]),
    ).toEqual([
      MentorshipRiskFlag.INACTIVE,
      MentorshipRiskFlag.NET_DROP,
      MentorshipRiskFlag.PLAN_SLIPPING,
    ]);
  });
});
