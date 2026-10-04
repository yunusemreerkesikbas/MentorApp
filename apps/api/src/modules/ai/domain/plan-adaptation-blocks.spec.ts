import { describe, expect, it } from "vitest";
import { fillPersonalizedPlanBlocks } from "./plan-adaptation-blocks";
import { parsePlanAdaptation } from "./plan-adaptation";

describe("personalized plan duration", () => {
  it.each([
    [125, [42, 42, 41]],
    [600, [200, 200, 200]],
  ])(
    "preserves the %i-minute budget without putting it in titles",
    (budget, durations) => {
      const changes = fillPersonalizedPlanBlocks({
        rawChanges: [],
        dates: ["2026-10-02"],
        minutesPerDay: budget,
        titleCounts: new Map(),
        focusSubjects: ["Matematik"],
        topics: [],
      });
      expect(changes.map((change) => change.durationMinutes)).toEqual(
        durations,
      );
      expect(
        changes.every((change) => !/\d+\s*(dk|min)/.test(change.title)),
      ).toBe(true);
    },
  );
});

describe("legacy day-count plans", () => {
  it.each([125, 600])(
    "keeps a %i-minute daily budget structured without selected weekdays",
    (budget) => {
      const result = parsePlanAdaptation(
        '{"changes":[]}',
        "2026-10-02",
        "PLAN",
        [],
        [],
        {
          days: 2,
          minutesPerDay: budget,
          focusSubjects: ["Matematik"],
        },
      );
      expect(result.kind).toBe("VALID");
      if (result.kind !== "VALID") return;
      const adds = result.changes.filter((change) => change.kind === "ADD");
      for (const date of ["2026-10-02", "2026-10-03"]) {
        const day = adds.filter((change) => change.taskDate === date);
        expect(
          day.reduce((sum, change) => sum + (change.durationMinutes ?? 0), 0),
        ).toBe(budget);
        expect(
          day.every(
            (change) =>
              change.durationMinutes! <= 200 &&
              !/\d+\s*(dk|min)/.test(change.title),
          ),
        ).toBe(true);
      }
    },
  );
});
