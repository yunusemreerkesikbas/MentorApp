import { describe, expect, it } from "vitest";
import { planWindowDays } from "./plan-coach-adaptation-brief-note";
import {
  STAGE_MAX_ROWS,
  buildStageScene,
  stageBeat,
  stageGaze,
} from "./plan-coach-stage-scene";

// A Wednesday, so the window runs Wed (3) … Tue (2).
const days = planWindowDays(new Date(2026, 9, 14, 12));
const knownWeek = { pendingCount: 3, subjects: ["Tarih", "Coğrafya"] };

describe("plan coach stage scene", () => {
  it("lights the picked days and colours the blocks by the picked subjects", () => {
    const scene = buildStageScene({
      days,
      knownWeek,
      input: {
        source: "PLAN",
        studyWeekdays: [3, 5, 1],
        focusSubjects: ["Matematik", "Türkçe"],
      },
    });
    expect(scene.columns.map((column) => column.active)).toEqual([
      true,
      false,
      true,
      false,
      false,
      true,
      false,
    ]);
    expect(scene.blocks).toEqual([
      "Matematik",
      "Türkçe",
      "Matematik",
      "Türkçe",
      "Matematik",
      "Türkçe",
    ]);
  });

  it("without the wizard lights every day and shows one block per waiting task", () => {
    const scene = buildStageScene({
      days,
      knownWeek,
      input: { source: "MOOD" },
    });
    expect(scene.columns.every((column) => column.active)).toBe(true);
    expect(scene.blocks).toEqual(["Tarih", "Coğrafya", "Tarih"]);
  });

  it("without the wizard stops at twelve blocks, and a week with nothing waiting has none", () => {
    const crowded = buildStageScene({
      days,
      knownWeek: { pendingCount: 40, subjects: ["Tarih"] },
      input: { source: "SESSION", sessionId: "s" },
    });
    expect(crowded.blocks).toHaveLength(12);

    const empty = buildStageScene({
      days,
      knownWeek: { pendingCount: 0, subjects: [] },
      input: { source: "MOOD" },
    });
    expect(empty.blocks).toEqual([]);
    expect(stageBeat(empty, 3)).toEqual([]);
    expect(stageGaze(empty, [], 3)).toBe("down");
  });

  it("with the wizard keeps the board filled whatever is waiting", () => {
    const scene = buildStageScene({
      days,
      knownWeek: { pendingCount: 1, subjects: ["Tarih"] },
      input: { source: "PLAN" },
    });
    expect(scene.blocks).toHaveLength(12);
  });

  it("draws neutral blocks when no subject is known", () => {
    const scene = buildStageScene({
      days,
      knownWeek: { pendingCount: 0, subjects: [] },
      input: { source: "PLAN", studyWeekdays: [3] },
    });
    expect(scene.blocks).toEqual([null, null, null, null]);
  });

  it("keeps every block on a lit day and never puts two in one place", () => {
    for (let lit = 1; lit <= 7; lit++) {
      const scene = buildStageScene({
        days,
        knownWeek,
        input: {
          source: "PLAN",
          studyWeekdays: days.slice(0, lit).map((day) => day.weekday),
        },
      });
      for (let beat = 0; beat < 60; beat++) {
        const slots = stageBeat(scene, beat);
        expect(slots).toHaveLength(scene.blocks.length);
        expect(new Set(slots.map((slot) => `${slot.column}:${slot.row}`)).size).toBe(
          slots.length,
        );
        for (const slot of slots) {
          expect(scene.columns[slot.column]!.active).toBe(true);
          expect(slot.row).toBeLessThan(STAGE_MAX_ROWS);
        }
      }
    }
  });

  it("moves between beats and replays the same way", () => {
    const scene = buildStageScene({ days, knownWeek, input: { source: "PLAN" } });
    expect(stageBeat(scene, 1)).not.toEqual(stageBeat(scene, 0));
    expect(stageBeat(scene, 7)).toEqual(stageBeat(scene, 7));
  });

  it("turns Puhu towards the side the leading block stands on", () => {
    const scene = buildStageScene({ days, knownWeek, input: { source: "PLAN" } });
    const at = (column: number) => stageGaze(scene, [{ column, row: 0 }], 0);
    expect([at(0), at(3), at(6)]).toEqual(["left", "down", "right"]);
  });
});
