import { describe, expect, it } from "vitest";
import type { PlanTaskDto } from "@mentor/types";
import { planEventColor, planEventNeutralColor } from "./plan-event-colors";
import { planTaskCalendarItem, planTaskCalendarItems } from "./plan-calendar-item";

const labels = { done: "Tamamlandı", hint: "Düzenlemek için tıkla" };

function task(overrides: Partial<PlanTaskDto> = {}): PlanTaskDto {
  return {
    id: "task-1",
    title: "Paragraf",
    subject: "Türkçe",
    topic: null,
    status: "PENDING",
    sortOrder: 0,
    taskDate: "2026-09-11",
    startTime: "09:00",
    endTime: "10:00",
    description: "Not",
    coachNote: null,
    origin: null,
    assignmentGroupId: null,
    ...overrides,
  };
}

describe("planTaskCalendarItem", () => {
  it("maps a timed pending task onto the shared calendar row", () => {
    const item = planTaskCalendarItem(task(), labels);
    expect(item).toMatchObject({
      id: "task-1",
      date: "2026-09-11",
      title: "Paragraf",
      startTime: "09:00",
      endTime: "10:00",
      meta: "Türkçe",
      groupKey: "Türkçe",
      muted: false,
      hint: labels.hint,
      description: "Not",
    });
    expect(item.color).toEqual(planEventColor("Türkçe"));
    expect(item.source.id).toBe("task-1");
  });

  it("treats a missing subject as neutral and a done task as muted", () => {
    const item = planTaskCalendarItem(
      task({ subject: null, status: "DONE", startTime: null, endTime: null }),
      labels,
    );
    expect(item.color).toEqual(planEventNeutralColor);
    expect(item.meta).toBeNull();
    expect(item.groupKey).toBeNull();
    expect(item.muted).toBe(true);
    expect(item.startTime).toBeNull();
    expect(item.hint).toBe(labels.done);
  });

  it("groups a date map without dropping empty days the caller already keyed", () => {
    const byDate = planTaskCalendarItems(
      { "2026-09-11": [task()], "2026-09-12": [] },
      labels,
    );
    expect(byDate["2026-09-11"]).toHaveLength(1);
    expect(byDate["2026-09-12"]).toEqual([]);
  });
});
