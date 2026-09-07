import { describe, expect, it } from "vitest";
import { hasNewPairs, isNewForStudent, toRiskPairs } from "./risk-pairs";

describe("toRiskPairs", () => {
  it("flattens student and flag into one comparable token", () => {
    expect(toRiskPairs([{ studentId: "a", flags: ["INACTIVE", "LOW_MOOD"] }])).toEqual([
      "a:INACTIVE",
      "a:LOW_MOOD",
    ]);
  });

  it("sorts, so the same situation always produces the same array", () => {
    const one = toRiskPairs([
      { studentId: "b", flags: ["NET_DROP"] },
      { studentId: "a", flags: ["INACTIVE"] },
    ]);
    const other = toRiskPairs([
      { studentId: "a", flags: ["INACTIVE"] },
      { studentId: "b", flags: ["NET_DROP"] },
    ]);
    expect(one).toEqual(other);
  });

  it("carries nothing for a student with no flags", () => {
    expect(toRiskPairs([{ studentId: "a", flags: [] }])).toEqual([]);
  });
});

describe("hasNewPairs", () => {
  it("is true only when something was not in the baseline", () => {
    const baseline = new Set(["a:INACTIVE"]);
    expect(hasNewPairs(["a:INACTIVE"], baseline)).toBe(false);
    expect(hasNewPairs(["a:INACTIVE", "a:LOW_MOOD"], baseline)).toBe(true);
  });

  it("is false for an empty set, so silence is never news", () => {
    expect(hasNewPairs([], new Set())).toBe(false);
  });
});

describe("isNewForStudent", () => {
  const baseline = new Set(["a:INACTIVE"]);

  it("stays quiet about a flag the coach was already told", () => {
    expect(isNewForStudent({ studentId: "a", flags: ["INACTIVE"] }, baseline)).toBe(false);
  });

  it("speaks up for a flag that landed since", () => {
    expect(isNewForStudent({ studentId: "a", flags: ["NET_DROP"] }, baseline)).toBe(true);
  });

  it("does not confuse two students carrying the same flag", () => {
    expect(isNewForStudent({ studentId: "b", flags: ["INACTIVE"] }, baseline)).toBe(true);
  });
});
