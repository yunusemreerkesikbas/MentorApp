import { describe, expect, it } from "vitest";
import { calculatePollPercentages } from "./forum-poll";

describe("calculatePollPercentages", () => {
  it("distributes rounding remainders by option order so results total 100", () => {
    expect(calculatePollPercentages([1, 1, 1])).toEqual([34, 33, 33]);
  });

  it("returns zero percentages when nobody has voted", () => {
    expect(calculatePollPercentages([0, 0])).toEqual([0, 0]);
  });

  it("keeps exact percentages unchanged", () => {
    expect(calculatePollPercentages([3, 1])).toEqual([75, 25]);
  });
});
