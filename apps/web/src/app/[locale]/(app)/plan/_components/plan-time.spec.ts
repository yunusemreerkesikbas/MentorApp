import { expect, it } from "vitest";
import { canonicalHm, minuteChoices } from "./plan-time";

it("pads a clock time and rejects a clock that does not exist", () => {
  expect(canonicalHm("9:05")).toBe("09:05");
  expect(canonicalHm("10:30")).toBe("10:30");
  expect(canonicalHm("24:00")).toBeNull();
  expect(canonicalHm("10:60")).toBeNull();
  expect(canonicalHm("")).toBeNull();
});

it("keeps an off-step minute in the picker", () => {
  expect(minuteChoices(null)).toEqual([0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]);
  expect(minuteChoices(7)).toContain(7);
  expect(minuteChoices(30)).not.toContain(7);
});
