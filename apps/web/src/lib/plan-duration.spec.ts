import { describe, expect, it } from "vitest";
import type { PlanTaskDto } from "@mentor/types";
import { buildStudySessionHrefFromPlanTask } from "./plan-study-session-link";
import { summarizeSubjectMonth } from "./plan-subject-summary";
import { buildTodayPath } from "../app/[locale]/(app)/dashboard/_components/today-path-model";
import {
  parseInitialMinutes,
  parseInitialBreakMinutes,
  parseInitialPreset,
} from "../app/[locale]/(app)/study-session/_components/session-params";

const task = {
  id: "33333333-3333-4333-8333-333333333333",
  title: "Review",
  subject: "Matematik",
  topic: null,
  status: "PENDING",
  sortOrder: 0,
  taskDate: "2026-10-02",
  startTime: "09:00",
  endTime: "11:00",
  durationMinutes: 80,
  sessionFocusMinutes: 80,
  description: null,
  coachNote: null,
  origin: null,
  assignmentGroupId: null,
} satisfies PlanTaskDto;

describe("plan duration reaches the session", () => {
  it.each([undefined, "dashboard", "coach"] as const)(
    "passes backend minutes from %s",
    (source) => {
      expect(buildStudySessionHrefFromPlanTask(task, source)).toHaveProperty(
        "query.minutes",
        "80",
      );
    },
  );

  it("shows the same backend duration on the dashboard node and CTA", () => {
    const path = buildTodayPath([task], null, 25);
    expect(path.cta).toMatchObject({ minutes: 80 });
    expect(path.nodes[0]).toHaveProperty("minutes", 80);
  });

  it("counts explicit durations before calendar slots, including all-day tasks", () => {
    const summary = summarizeSubjectMonth(
      "Matematik",
      {
        "2026-10-02": [
          task,
          { ...task, startTime: null, endTime: null, durationMinutes: 41 },
        ],
      },
      "2026-10",
      "2026-10-02",
    );
    expect(summary.plannedMinutes).toBe(121);
  });

  it.each(["41", "80", "200"])(
    "opens %s as a custom session with a five-minute break",
    (minutes) => {
      expect(parseInitialMinutes(null, minutes)).toBe(Number(minutes));
      expect(parseInitialPreset(null, minutes)).toBe("custom");
      expect(parseInitialBreakMinutes(null, minutes)).toBe(5);
    },
  );

  it.each([
    ["25_5", 25, 5],
    ["50_10", 50, 10],
  ] as const)("keeps the %s preset and break", (preset, focus, pause) => {
    expect(parseInitialPreset(preset, null)).toBe(preset);
    expect(parseInitialMinutes(preset, null)).toBe(focus);
    expect(parseInitialBreakMinutes(preset, null)).toBe(pause);
  });

  it.each(["4", "201", "41.5", "80oops"])(
    "does not reinterpret invalid minutes %s",
    (minutes) => {
      expect(parseInitialMinutes(null, minutes)).toBe(25);
      expect(parseInitialPreset(null, minutes)).toBe("25_5");
    },
  );
});

it.each([undefined, "dashboard", "coach"] as const)(
  "opens an untimed task from %s as a stopwatch",
  (source) => {
    const untimed = {
      ...task,
      durationMinutes: null,
      sessionFocusMinutes: null,
    };
    expect(
      buildStudySessionHrefFromPlanTask(untimed, source).query,
    ).toMatchObject({ preset: "stopwatch" });
    expect(
      buildStudySessionHrefFromPlanTask(untimed, source).query,
    ).not.toHaveProperty("minutes");
    expect(buildTodayPath([untimed], null, 25).cta).toMatchObject({
      minutes: null,
    });
    expect(parseInitialPreset("stopwatch", null)).toBe("stopwatch");
    expect(parseInitialBreakMinutes("stopwatch", null)).toBe(0);
  },
);
