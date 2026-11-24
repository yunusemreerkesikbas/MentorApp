import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { noteLines } from "../components/panel/chest.ts";

describe("weekly chest note lines", () => {
  it("leaves zero lines off and splits focus time into hours and minutes", () => {
    assert.deepEqual(
      noteLines({ activeDays: 5, focusSessions: 0, planTasks: 3, focusMinutes: 125 }).map((line) => [
        line.key,
        line.values,
      ]),
      [
        ["chest_note_days", { count: 5 }],
        ["chest_note_tasks", { count: 3 }],
        ["chest_note_focus_hm", { hours: 2, minutes: 5 }],
      ],
    );
    assert.equal(noteLines({ activeDays: 1, focusSessions: 1, planTasks: 0, focusMinutes: 60 })[2]?.key, "chest_note_focus_h");
    assert.equal(noteLines({ activeDays: 1, focusSessions: 1, planTasks: 0, focusMinutes: 40 })[2]?.key, "chest_note_focus_m");
  });
});
