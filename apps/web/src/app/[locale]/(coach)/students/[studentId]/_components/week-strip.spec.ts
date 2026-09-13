import { describe, expect, it } from "vitest";
import type { MentorshipReportPlanTaskDto } from "@mentor/types";
import { buildWeekStrip, summarizeMine } from "./week-strip";

const WEDNESDAY = "2026-09-09";

function task(over: Partial<MentorshipReportPlanTaskDto> = {}): MentorshipReportPlanTaskDto {
  return {
    taskDate: WEDNESDAY,
    title: "Paragraf 20 soru",
    subject: "Türkçe",
    topic: "Paragraf",
    status: "PENDING",
    assignedByCoach: false,
    coachNote: null,
    ...over,
  };
}

describe("buildWeekStrip", () => {
  it("starts on the Monday of today's week and marks today", () => {
    const days = buildWeekStrip([], WEDNESDAY);
    expect(days.map((day) => day.date)).toEqual([
      "2026-09-07",
      "2026-09-08",
      "2026-09-09",
      "2026-09-10",
      "2026-09-11",
      "2026-09-12",
      "2026-09-13",
    ]);
    expect(days.filter((day) => day.isToday).map((day) => day.date)).toEqual([WEDNESDAY]);
  });

  it("keeps Sunday in the week that began six days earlier", () => {
    expect(buildWeekStrip([], "2026-09-13")[0]?.date).toBe("2026-09-07");
    expect(buildWeekStrip([], "2026-09-07")[0]?.date).toBe("2026-09-07");
  });

  it("counts done and pending per day, upcoming days included", () => {
    const days = buildWeekStrip(
      [
        task({ taskDate: "2026-09-07", status: "DONE" }),
        task({ taskDate: "2026-09-07" }),
        task({ taskDate: "2026-09-12" }),
      ],
      WEDNESDAY,
    );
    expect(days[0]).toMatchObject({ done: 1, pending: 1 });
    expect(days[5]).toMatchObject({ done: 0, pending: 1 });
  });

  it("leaves out tasks from the neighbouring weeks", () => {
    const days = buildWeekStrip(
      [task({ taskDate: "2026-09-06" }), task({ taskDate: "2026-09-14", status: "DONE" })],
      WEDNESDAY,
    );
    expect(days.every((day) => day.done === 0 && day.pending === 0)).toBe(true);
  });
});

describe("summarizeMine", () => {
  it("counts only the rows this coach assigned", () => {
    expect(
      summarizeMine([
        task({ assignedByCoach: true, status: "DONE" }),
        task({ assignedByCoach: true }),
        task({ status: "DONE" }),
      ]),
    ).toEqual({ done: 1, total: 2 });
  });
});
