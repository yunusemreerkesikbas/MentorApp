import { describe, expect, it } from "vitest";
import type { CoachPlanItemDto } from "@mentor/types";
import {
  coachPlanCalendarItem,
  coachPlanCalendarItems,
  coachPlanColorKey,
  coachPlanMarkedDates,
} from "./coach-plan-calendar-item";
import { planEventColor, planEventNeutralColor } from "./plan-event-colors";

const labels = {
  personal: "Kişisel",
  cancelled: "Etkinlik iptal edildi",
  hint: "Detay için tıkla",
};

const ayse = {
  studentId: "a",
  studentDisplayName: "Ayşe",
  studentUsername: null,
  avatarUrl: null,
};
const bora = {
  studentId: "b",
  studentDisplayName: "Bora",
  studentUsername: null,
  avatarUrl: null,
};

function task(
  id: string,
  participants: Array<typeof ayse> = [],
): CoachPlanItemDto {
  return {
    kind: "TASK",
    task: {
      id,
      assignmentGroupId: null,
      status: participants.length === 0 ? "PENDING" : null,
      taskDate: "2026-09-11",
      title: id,
      subject: null,
      topic: null,
      startTime: null,
      endTime: null,
      coachNote: "Not",
      participants: participants.map((person) => ({
        ...person,
        taskId: `${id}:${person.studentId}`,
        status: "PENDING",
      })),
    },
  };
}

function event(
  id: string,
  attendees: Array<typeof ayse> = [],
  status: "SCHEDULED" | "CANCELLED" = "SCHEDULED",
): CoachPlanItemDto {
  return {
    kind: "EVENT",
    event: {
      id,
      seriesId: null,
      organizerUserId: "coach",
      orgId: null,
      title: id,
      description: "Görüşme",
      eventDate: "2026-09-12",
      startTime: "10:00",
      endTime: "10:30",
      status,
      attendeeCount: attendees.length,
      recurrence: null,
      createdAt: "2026-09-01T00:00:00.000Z",
      updatedAt: "2026-09-01T00:00:00.000Z",
      attendees,
    },
  };
}

describe("coachPlanCalendarItem", () => {
  it("keeps personal items on the neutral swatch and labels them personal", () => {
    const item = coachPlanCalendarItem(task("solo"), labels);
    expect(item.color).toEqual(planEventNeutralColor);
    expect(item.meta).toBe("Kişisel");
    expect(item.glyph).toBe("task");
    expect(item.muted).toBe(false);
    expect(item.description).toBe("Not");
    expect(coachPlanColorKey(item.source)).toBeNull();
  });

  it("hashes the sorted attendee set so one student always lands on the same swatch", () => {
    const one = coachPlanCalendarItem(task("one", [ayse]), labels);
    const same = coachPlanCalendarItem(event("same", [ayse]), labels);
    const cohort = coachPlanCalendarItem(task("cohort", [bora, ayse]), labels);
    expect(one.color).toEqual(planEventColor("a"));
    expect(same.color).toEqual(one.color);
    expect(cohort.color).toEqual(planEventColor("a|b"));
    expect(one.meta).toBe("Ayşe");
    expect(cohort.meta).toBe("Bora, Ayşe");
    expect(one.glyph).toBe("task");
    expect(same.glyph).toBe("event");
  });

  it("mutes cancelled events and keeps all-day tasks untimed", () => {
    const cancelled = coachPlanCalendarItem(event("x", [ayse], "CANCELLED"), labels);
    expect(cancelled.muted).toBe(true);
    expect(cancelled.hint).toBe(labels.cancelled);
    const allDay = coachPlanCalendarItem(task("all-day"), labels);
    expect(allDay.startTime).toBeNull();
    expect(allDay.hint).toBe(labels.hint);
  });
});

describe("coachPlanCalendarItems", () => {
  it("fills every requested day so empty cells stay present", () => {
    const days = ["2026-09-11", "2026-09-12", "2026-09-13"];
    const byDate = coachPlanCalendarItems(
      [task("solo"), event("meet", [ayse])],
      days,
      labels,
    );
    expect(byDate["2026-09-11"]).toHaveLength(1);
    expect(byDate["2026-09-12"]).toHaveLength(1);
    expect(byDate["2026-09-13"]).toEqual([]);
  });
});

describe("coachPlanMarkedDates", () => {
  it("returns unique item dates", () => {
    expect(coachPlanMarkedDates([task("a"), task("b"), event("c")]).sort()).toEqual([
      "2026-09-11",
      "2026-09-12",
    ]);
  });
});
