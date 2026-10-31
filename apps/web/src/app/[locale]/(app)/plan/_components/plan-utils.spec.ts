import { expect, it } from "vitest";
import { stepMonth, type MonthStep } from "./plan-utils";

function walk(start: string, moves: number[]): string[] {
  let last: MonthStep | null = null;
  let date = start;
  return moves.map((move) => {
    last = stepMonth(date, move, last);
    date = last.date;
    return date;
  });
}

it("returns to the 31st after stepping through a shorter month", () => {
  expect(walk("2026-10-31", [1, -1])).toEqual(["2026-11-30", "2026-10-31"]);
  expect(walk("2026-01-31", [1, 1])).toEqual(["2026-02-28", "2026-03-31"]);
  expect(walk("2026-03-31", [-1, -1])).toEqual(["2026-02-28", "2026-01-31"]);
  expect(walk("2027-12-31", [2, -2])).toEqual(["2028-02-29", "2027-12-31"]);
});

it("keeps an ordinary day as is", () => {
  expect(walk("2026-10-15", [1, -1])).toEqual(["2026-11-15", "2026-10-15"]);
});

it("starts over from a day the user picked in between", () => {
  const landed = stepMonth("2026-10-31", 1, null);
  expect(stepMonth("2026-11-12", -1, landed).date).toBe("2026-10-12");
});
