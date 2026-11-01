import { describe, expect, it } from "vitest";
import type { PlanTaskDto } from "@mentor/types";
import { buildTodayPath, sessionHrefFor } from "./today-path-model";

function task(index: number, overrides: Partial<PlanTaskDto> = {}): PlanTaskDto {
  return {
    id: `task-${index}`,
    title: `Görev ${index}`,
    subject: null,
    topic: null,
    status: "PENDING",
    sortOrder: index,
    taskDate: "2026-09-21",
    startTime: null,
    endTime: null,
    durationMinutes: null,
    sessionFocusMinutes: 25,
    description: null,
    coachNote: null,
    origin: null,
    assignmentGroupId: null,
    ...overrides,
  } as PlanTaskDto;
}

const done = (index: number) => task(index, { status: "DONE" });

describe("buildTodayPath", () => {
  it("marks done, current (first pending) and upcoming nodes", () => {
    const path = buildTodayPath([done(0), task(1), task(2)], 25);

    expect(path.nodes.map((node) => node.state)).toEqual(["done", "current", "upcoming"]);
    expect(path.done).toBe(1);
    expect(path.total).toBe(3);
    expect(path.cta).toMatchObject({ kind: "START_TASK", task: { id: "task-1" } });
  });

  it("keeps the current task inside the window when it is the 7th of 9", () => {
    const tasks = [0, 1, 2, 3, 4, 5].map(done).concat([task(6), task(7), task(8)]);
    const path = buildTodayPath(tasks, 25);

    expect(path.nodes.map((node) => node.task.id)).toEqual([
      "task-4",
      "task-5",
      "task-6",
      "task-7",
      "task-8",
    ]);
    expect(path.nodes[2]!.state).toBe("current");
    expect(path.hiddenBefore).toBe(4);
    expect(path.hiddenAfter).toBe(0);
  });

  it("folds the tail into +N when the current task is early", () => {
    const tasks = [0, 1, 2, 3, 4, 5, 6].map((index) => task(index));
    const path = buildTodayPath(tasks, 25);

    expect(path.nodes).toHaveLength(5);
    expect(path.hiddenBefore).toBe(0);
    expect(path.hiddenAfter).toBe(2);
  });

  it("shows the last window once every task is done", () => {
    const tasks = [0, 1, 2, 3, 4, 5].map(done);
    const path = buildTodayPath(tasks, 25);

    expect(path.cta.kind).toBe("DAY_COMPLETE");
    expect(path.nodes.map((node) => node.task.id)[4]).toBe("task-5");
    expect(path.hiddenBefore).toBe(1);
  });

  it("asks for a first task on an empty day", () => {
    const path = buildTodayPath([], 25);

    expect(path.cta.kind).toBe("ADD_TASK");
    expect(path.nodes).toEqual([]);
    expect(path.hiddenBefore).toBe(0);
    expect(path.hiddenAfter).toBe(0);
  });

  it("flags tasks assigned by a human coach", () => {
    const coachTask = task(0, { origin: { type: "MENTORSHIP", linkId: "link-1" } });
    const aiTask = task(1, { origin: { type: "AI_COACH", coachMessageId: "m-1" } });
    const path = buildTodayPath([coachTask, aiTask], 25);

    expect(path.nodes.map((node) => node.fromCoach)).toEqual([true, false]);
  });

  describe("CTA minutes", () => {
    it("uses the task's own 40 minute range and passes it to the session", () => {
      const path = buildTodayPath([task(0, { startTime: "14:00", endTime: "14:40", sessionFocusMinutes: 40 })], 25);
      expect(path.cta).toMatchObject({ minutes: 40 });
    });

    it("falls back to the preset when the range is longer than the session allows", () => {
      const path = buildTodayPath([task(0, { startTime: "14:00", endTime: "18:00", sessionFocusMinutes: 25 })], 25);
      expect(path.cta).toMatchObject({ minutes: 25 });
    });

    it("falls back to the preset when the task has no time range", () => {
      const path = buildTodayPath([task(0, { sessionFocusMinutes: 50 })], 50);
      expect(path.cta).toMatchObject({ minutes: 50 });
    });

    it("uses the backend preset duration without recomputing the time range", () => {
      const path = buildTodayPath([task(0, { startTime: "09:00", endTime: "09:25" })], 25);
      expect(path.cta).toMatchObject({ minutes: 25 });
    });
  });
});

describe("sessionHrefFor", () => {
  it("opens the session from the panel, with the task's own length when it has one", () => {
    const ranged = task(0, { startTime: "14:00", endTime: "14:40", sessionFocusMinutes: 40, subject: "Tarih" });
    expect(sessionHrefFor(ranged)).toEqual({
      pathname: "/study-session",
      query: {
        taskId: "task-0",
        source: "dashboard",
        taskTitle: "Görev 0",
        subject: "Tarih",
        minutes: "40",
      },
    });
    expect(sessionHrefFor(task(1))).toMatchObject({
      query: { taskId: "task-1", source: "dashboard" },
    });
    expect(sessionHrefFor(task(1))).toHaveProperty("query.minutes", "25");
  });
});
