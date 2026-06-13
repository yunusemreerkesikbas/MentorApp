import { describe, expect, it } from "vitest";
import { computeSubjectNet, computeTotalNet, formatNet } from "./net";

const KPSS_RULE = { kind: "PENALTY", divisor: 4 };

describe("computeSubjectNet", () => {
  it("applies KPSS penalty rule (4 wrong = -1 correct)", () => {
    expect(computeSubjectNet({ correct: 20, wrong: 4, blank: 6 }, KPSS_RULE)).toBe(19);
    expect(computeSubjectNet({ correct: 10, wrong: 8, blank: 12 }, KPSS_RULE)).toBe(8);
  });

  it("throws for unsupported net rule kinds", () => {
    expect(() =>
      computeSubjectNet({ correct: 15, wrong: 5, blank: 0 }, { kind: "RAW", divisor: 1 }),
    ).toThrow(/Unsupported net rule kind/);
  });
});

describe("computeTotalNet", () => {
  it("sums subject nets with two-decimal rounding", () => {
    expect(computeTotalNet([19, 18.75, 20])).toBe(57.75);
  });
});

describe("formatNet", () => {
  it("formats to two decimal places", () => {
    expect(formatNet(57.75)).toBe("57.75");
    expect(formatNet(10)).toBe("10.00");
  });
});
