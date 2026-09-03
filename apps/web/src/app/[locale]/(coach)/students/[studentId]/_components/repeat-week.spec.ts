import { describe, expect, it } from "vitest";
import type { MentorshipReportPlanTaskDto } from "@mentor/types";
import { buildRepeatDrafts } from "./repeat-week";

const TODAY = "2026-09-03"; // Thursday
/** The seven days the composer shows when parked on "this week". */
const THIS_WEEK = [
  "2026-09-03",
  "2026-09-04",
  "2026-09-05",
  "2026-09-06",
  "2026-09-07",
  "2026-09-08",
  "2026-09-09",
];

function task(over: Partial<MentorshipReportPlanTaskDto> = {}): MentorshipReportPlanTaskDto {
  return {
    taskDate: "2026-08-27",
    title: "Paragraf 20 soru",
    subject: "Türkçe",
    topic: "Paragraf",
    status: "DONE",
    assignedByCoach: true,
    coachNote: "Süre tut",
    ...over,
  };
}

describe("buildRepeatDrafts", () => {
  it("moves last week's coach tasks onto the same weekday of the shown week", () => {
    // 2026-08-27 is the Thursday one week before TODAY -> offset 0 -> days[0].
    expect(buildRepeatDrafts([task()], THIS_WEEK, TODAY, 21)).toEqual([
      {
        title: "Paragraf 20 soru",
        subject: "Türkçe",
        topic: "Paragraf",
        coachNote: "Süre tut",
        taskDate: "2026-09-03",
      },
    ]);
  });

  it("keeps the position within the week", () => {
    const drafts = buildRepeatDrafts(
      [task({ taskDate: "2026-08-29" }), task({ taskDate: "2026-09-02" })],
      THIS_WEEK,
      TODAY,
      21,
    );
    expect(drafts.map((d) => d.taskDate)).toEqual(["2026-09-05", "2026-09-09"]);
  });

  it("maps onto a future week the same way (the button steps by exactly 7)", () => {
    const nextWeek = THIS_WEEK.map((d) =>
      new Date(Date.parse(`${d}T00:00:00Z`) + 7 * 86_400_000).toISOString().slice(0, 10),
    );
    const drafts = buildRepeatDrafts([task()], nextWeek, TODAY, 21);
    expect(drafts[0]?.taskDate).toBe("2026-09-10");
  });

  it("skips the student's own plan rows", () => {
    expect(buildRepeatDrafts([task({ assignedByCoach: false })], THIS_WEEK, TODAY, 21)).toEqual([]);
  });

  it("skips rows outside the seven days before today", () => {
    const outside = [
      task({ taskDate: "2026-08-26" }), // eight days back
      task({ taskDate: TODAY }), // today is already the target week
      task({ taskDate: "2026-09-20" }), // scheduled ahead
    ];
    expect(buildRepeatDrafts(outside, THIS_WEEK, TODAY, 21)).toEqual([]);
  });

  it("stops at the remaining capacity", () => {
    const many = Array.from({ length: 10 }, () => task());
    expect(buildRepeatDrafts(many, THIS_WEEK, TODAY, 3)).toHaveLength(3);
    expect(buildRepeatDrafts(many, THIS_WEEK, TODAY, 0)).toEqual([]);
  });

  it("returns nothing when there is no source week", () => {
    expect(buildRepeatDrafts([], THIS_WEEK, TODAY, 21)).toEqual([]);
  });
});
