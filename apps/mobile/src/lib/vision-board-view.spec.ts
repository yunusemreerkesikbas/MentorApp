import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { VisionDto, ZoneView } from "@mentor/types";
import { changeBoardItem, goalFields, openBoard, shareRooms } from "./vision-board-view.ts";
import { applyTemplate } from "@mentor/core/board-templates";

const goal: VisionDto = { goalTitle: "My goal", targetCityCode: "42", targetCity: null,
  targetUniversityId: "university", targetTitleId: null, targetInstitutionId: null, careerGroup: "YAZILIM",
  motivation: "Legacy note", aiNote: null, board: null, createdAt: "", updatedAt: "",
  targetNames: { universityName: "University", cityName: "Konya", titleName: null, institutionName: null } };

describe("mobile goal and collage", () => {
  it("retains every saved target and the legacy motivation when editing the goal", () => {
    const fields = goalFields(goal);
    assert.equal(fields.targetUniversityId, goal.targetUniversityId);
    assert.equal(fields.targetCityCode, goal.targetCityCode);
    assert.equal(fields.motivation, goal.motivation);
    assert.equal(fields.careerGroup, goal.careerGroup);
    assert.equal(goalFields(null).goalTitle, "");
  });
  it("seeds new boards once and reopens user edits without reseeding", () => {
    const seed = openBoard(goal);
    const first = seed.items[0]!;
    const placed = applyTemplate(seed, "hero");
    const moved = changeBoardItem(placed, first.id, item => ({ ...item, x: 33 }));
    assert.notEqual(moved.items[0]!.x, seed.items[0]!.x);
    assert.equal(openBoard({ ...goal, board: moved }), moved);
    assert.equal(moved.items[1], placed.items[1]);
  });
  it("shares only to joined chat rooms or announcements the writer moderates", () => {
    const zones = [{ type: "CHAT", myStatus: "ACTIVE" }, { type: "QA", myStatus: "ACTIVE" },
      { type: "ANNOUNCEMENT", myStatus: "ACTIVE", canModerate: true },
      { type: "ANNOUNCEMENT", myStatus: "ACTIVE" }, { type: "CHAT", myStatus: "NONE" }] as ZoneView[];
    assert.deepEqual(shareRooms(zones), [zones[0], zones[2]]);
  });
});
