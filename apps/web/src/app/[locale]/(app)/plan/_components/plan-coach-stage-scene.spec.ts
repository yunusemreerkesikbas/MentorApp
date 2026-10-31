import type { CoachPlanAdaptationBriefDto } from "@mentor/types";
import { describe, expect, it } from "vitest";
import {
  STAGE_MAX_NOTES,
  stageNoteIndex,
  stageNotes,
  stagePileDepth,
} from "./plan-coach-stage-scene";

const evidence = (count: number): CoachPlanAdaptationBriefDto["evidence"] =>
  Array.from({ length: count }, (_, index) => ({
    type: "WEAK_SUBJECTS",
    summary: `line ${index}`,
    observedAt: "2026-10-31T10:00:00.000Z",
  })) as CoachPlanAdaptationBriefDto["evidence"];

describe("plan coach stage scene", () => {
  it("has no notes without a brief", () => {
    expect(stageNotes(null)).toEqual([]);
  });

  it("keeps the first six notes in the coach's order", () => {
    const brief = {
      groundingLine: null,
      evidence: evidence(8),
    } as unknown as CoachPlanAdaptationBriefDto;
    const notes = stageNotes(brief);
    expect(notes).toHaveLength(STAGE_MAX_NOTES);
    expect(notes.map((note) => note.summary)).toEqual([
      "line 0",
      "line 1",
      "line 2",
      "line 3",
      "line 4",
      "line 5",
    ]);
  });

  it("turns to the next note every line and wraps around", () => {
    expect(stageNoteIndex(0, 2)).toBe(0);
    expect(stageNoteIndex(3_600, 2)).toBe(1);
    expect(stageNoteIndex(7_200, 2)).toBe(0);
    expect(stageNoteIndex(9_999, 0)).toBe(0);
  });

  it("piles at most two sheets under the top note", () => {
    expect(stagePileDepth(0, 6)).toBe(0);
    expect(stagePileDepth(3_600, 6)).toBe(1);
    expect(stagePileDepth(50_000, 6)).toBe(2);
  });

  it("never piles more sheets than there are other notes", () => {
    expect(stagePileDepth(50_000, 2)).toBe(1);
    expect(stagePileDepth(50_000, 1)).toBe(0);
    expect(stagePileDepth(50_000, 0)).toBe(0);
  });
});
