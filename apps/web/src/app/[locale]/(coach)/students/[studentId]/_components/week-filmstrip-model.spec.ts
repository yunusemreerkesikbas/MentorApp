import { describe, expect, it } from "vitest";
import type { MentorshipReportPlanTaskDto } from "@mentor/types";
import { seriesDates } from "../../../_components/activity-tone";
import {
  buildRhythm,
  buildWeekFilm,
  groupPlanTasks,
  mondayOf,
  weekSummary,
} from "./week-filmstrip-model";

/** A Thursday on the Istanbul calendar; its week runs 21–27 September. */
const TODAY = "2026-09-24";

/** A 28-day series ending today, zero except the given days. */
function series(minutes: Record<string, number> = {}): number[] {
  return seriesDates(28, TODAY).map((date) => minutes[date] ?? 0);
}

function task(over: Partial<MentorshipReportPlanTaskDto> = {}): MentorshipReportPlanTaskDto {
  return {
    taskDate: TODAY,
    title: "Paragraf 20 soru",
    subject: "Türkçe",
    topic: "Paragraf",
    status: "PENDING",
    assignedByCoach: true,
    coachNote: null,
    ...over,
  };
}

describe("mondayOf", () => {
  it("keeps a week Monday-first, Sunday included", () => {
    expect(mondayOf("2026-09-24")).toBe("2026-09-21");
    expect(mondayOf("2026-09-21")).toBe("2026-09-21");
    expect(mondayOf("2026-09-27")).toBe("2026-09-21");
  });
});

describe("buildWeekFilm", () => {
  it("draws this week's minutes and leaves the days to come undrawn", () => {
    const days = buildWeekFilm(series({ "2026-09-21": 45, [TODAY]: 25 }), [], TODAY);
    expect(days.map((day) => day.date)).toEqual([
      "2026-09-21",
      "2026-09-22",
      "2026-09-23",
      "2026-09-24",
      "2026-09-25",
      "2026-09-26",
      "2026-09-27",
    ]);
    expect(days.map((day) => day.kind)).toEqual([
      "past",
      "past",
      "past",
      "today",
      "future",
      "future",
      "future",
    ]);
    expect(days.map((day) => day.minutes)).toEqual([45, 0, 0, 25, null, null, null]);
  });

  it("keeps the coach's tasks apart from the student's own", () => {
    const days = buildWeekFilm(
      series(),
      [
        task({ taskDate: "2026-09-21", status: "DONE" }),
        task({ taskDate: "2026-09-21", assignedByCoach: false, status: "DONE" }),
        task({ taskDate: "2026-09-25" }),
        task({ taskDate: "2026-09-25", assignedByCoach: false }),
      ],
      TODAY,
    );
    expect(days[0]).toMatchObject({ coach: { done: 1, pending: 0 }, own: { done: 1, pending: 0 } });
    expect(days[4]).toMatchObject({ coach: { done: 0, pending: 1 }, own: { done: 0, pending: 1 } });
  });

  it("leaves out tasks from the neighbouring weeks", () => {
    const days = buildWeekFilm(
      series(),
      [task({ taskDate: "2026-09-20", status: "DONE" }), task({ taskDate: "2026-09-28" })],
      TODAY,
    );
    expect(days.every((day) => day.coach.done + day.coach.pending === 0)).toBe(true);
  });
});

describe("weekSummary", () => {
  it("adds up the minutes so far and the coach's tasks for the whole week", () => {
    const days = buildWeekFilm(
      series({ "2026-09-21": 45, "2026-09-22": 80, [TODAY]: 25, "2026-09-20": 300 }),
      [
        task({ taskDate: "2026-09-21", status: "DONE" }),
        task({ taskDate: "2026-09-22", status: "DONE" }),
        task({ taskDate: "2026-09-23" }),
        task({ taskDate: "2026-09-25" }),
        task({ taskDate: "2026-09-24", assignedByCoach: false, status: "DONE" }),
      ],
      TODAY,
    );
    expect(weekSummary(days)).toEqual({ minutes: 150, coachDone: 2, coachTotal: 4 });
  });
});

describe("buildRhythm", () => {
  it("lays four Monday-first weeks ending with this one, the days to come blank", () => {
    const rhythm = buildRhythm(series({ "2026-08-31": 60, [TODAY]: 20 }), TODAY);
    expect(rhythm.cells).toHaveLength(28);
    expect(rhythm.cells[0]).toEqual({ date: "2026-08-31", minutes: 60 });
    expect(rhythm.cells[24]).toEqual({ date: TODAY, minutes: 20 });
    expect(rhythm.cells.slice(25).map((cell) => cell.minutes)).toEqual([null, null, null]);
  });

  it("totals only the drawn days, not the series days before the first Monday", () => {
    // 2026-08-28 is in the series (27 days back) but precedes the grid's first Monday.
    const rhythm = buildRhythm(series({ "2026-08-28": 500, "2026-09-01": 40, [TODAY]: 20 }), TODAY);
    expect(rhythm.totalMinutes).toBe(60);
    expect(rhythm.activeDays).toBe(2);
  });
});

describe("groupPlanTasks", () => {
  it("orders this week, what comes after it, last week and anything earlier", () => {
    const groups = groupPlanTasks(
      [
        task({ taskDate: "2026-09-10", title: "earlier" }),
        task({ taskDate: "2026-09-29", title: "upcoming" }),
        task({ taskDate: "2026-09-16", title: "last week" }),
        task({ taskDate: "2026-09-26", title: "this week, later" }),
        task({ taskDate: "2026-09-21", title: "this week, first" }),
      ],
      TODAY,
    );
    expect(groups.map((group) => group.key)).toEqual([
      "this_week",
      "upcoming",
      "last_week",
      "earlier",
    ]);
    expect(groups[0]!.tasks.map((row) => row.title)).toEqual([
      "this week, first",
      "this week, later",
    ]);
  });

  it("draws no empty group", () => {
    expect(groupPlanTasks([task()], TODAY).map((group) => group.key)).toEqual(["this_week"]);
    expect(groupPlanTasks([], TODAY)).toEqual([]);
  });
});
