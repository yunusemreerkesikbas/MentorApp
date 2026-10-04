import { describe, expect, it } from "vitest";
import {
  composerMode,
  copyKey,
  copyTask,
  dayCount,
  followDay,
  hasUnsavedInput,
  monday,
  shiftDate,
  showWeek,
  type AssignDraft,
} from "./planning-state";
import { todayInIstanbul } from "@/lib/date-time";

const draft = (over: Partial<AssignDraft> = {}): AssignDraft => ({
  key: "k1",
  taskDate: "2026-09-24",
  title: "Paragraf: 25 soru",
  subject: null,
  topic: null,
  coachNote: null,
  ...over,
});

describe("the day chip's count", () => {
  it("says tasks, drafts, both, or nothing", () => {
    expect(dayCount(2, 0)).toEqual({ kind: "existing", existing: 2 });
    expect(dayCount(2, 1)).toEqual({ kind: "both", existing: 2, drafts: 1 });
    expect(dayCount(0, 1)).toEqual({ kind: "drafts", drafts: 1 });
    expect(dayCount(0, 0)).toEqual({ kind: "none" });
  });

  it("waits for the week's tasks, but never hides a draft it already knows", () => {
    expect(dayCount(undefined, 0)).toEqual({ kind: "loading" });
    expect(dayCount(undefined, 1)).toEqual({ kind: "drafts", drafts: 1 });
  });
});

describe("the always-open composer", () => {
  const saved = [draft({ key: "saved" })];

  it("is adding a new task unless it holds a draft from the program", () => {
    expect(composerMode(null, saved)).toBe("new");
    expect(composerMode(draft({ key: "typed" }), saved)).toBe("new");
    expect(composerMode(draft({ key: "saved" }), saved)).toBe("edit");
  });

  it("moves a new task to the chosen day, but never an edited one", () => {
    expect(followDay(null, "2026-09-25", saved)).toBeNull();
    expect(followDay(draft({ key: "typed" }), "2026-09-25", saved)?.taskDate).toBe("2026-09-25");
    expect(followDay(draft({ key: "saved" }), "2026-09-25", saved)?.taskDate).toBe("2026-09-24");
  });

  it("holds unsaved input while editing, or while a new task has anything typed in it", () => {
    expect(hasUnsavedInput(null, saved)).toBe(false);
    expect(hasUnsavedInput(draft({ key: "typed", title: "  " }), saved)).toBe(false);
    expect(hasUnsavedInput(draft({ key: "typed", title: "", coachNote: "Süre tut" }), saved)).toBe(true);
    expect(hasUnsavedInput(draft({ key: "typed" }), saved)).toBe(true);
    expect(hasUnsavedInput(draft({ key: "saved", title: "" }), saved)).toBe(true);
  });
});

describe("weekly planning dates", () => {
  it("uses Monday through Sunday across the year boundary", () => {
    expect(monday("2027-01-03")).toBe("2026-12-28");
    expect(monday("2027-01-04")).toBe("2027-01-04");
    expect(shiftDate("2026-12-28", 6)).toBe("2027-01-03");
  });
  it("uses Istanbul midnight independently of the browser timezone", () => {
    expect(todayInIstanbul(new Date("2026-09-20T21:01:00Z"))).toBe(
      "2026-09-21",
    );
  });
  it("copies the weekday without mutating the source or leaking identifiers/status", () => {
    const source = {
      id: "task",
      taskDate: "2026-09-16",
      title: "Practice",
      subject: null,
      topic: null,
      coachNote: "Review",
      status: "DONE",
      assignedByCoach: true,
    };
    const result = copyTask(source, "2026-09-14", "2026-09-21");
    expect(result.taskDate).toBe("2026-09-23");
    expect(result).not.toHaveProperty("status");
    expect(result).not.toHaveProperty("id");
    expect(source.taskDate).toBe("2026-09-16");
    expect(copyKey(source.id, "2026-09-21")).not.toBe(
      copyKey(source.id, "2026-09-28"),
    );
  });
});

describe("moving the week", () => {
  const state = (editor: AssignDraft | null) => ({
    week: "2026-09-21",
    day: "2026-09-24",
    editor,
    copied: [],
  });

  it("opens today in this week and the Monday in any other, and a typed task goes with it", () => {
    const typed = draft({ key: "typed", taskDate: "2026-09-24" });
    const next = showWeek(state(typed), "2026-09-28", "2026-09-24", []);
    expect(next.week).toBe("2026-09-28");
    expect(next.day).toBe("2026-09-28");
    // The chip that is lit is the date the task lands on (review finding: it stayed a week behind).
    expect(next.editor?.taskDate).toBe("2026-09-28");
    expect(showWeek(next, "2026-09-21", "2026-09-24", []).day).toBe("2026-09-24");
  });

  it("leaves an edited draft on its own date", () => {
    const saved = draft({ key: "saved", taskDate: "2026-09-24" });
    const next = showWeek(state({ ...saved }), "2026-09-28", "2026-09-24", [saved]);
    expect(next.editor?.taskDate).toBe("2026-09-24");
  });
});