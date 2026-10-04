import { describe, expect, it } from "vitest";
import type { PlanEventDto } from "@mentor/types";
import { planEventNeutralColor } from "./plan-event-colors";
import { groupPlanEventsByDate, studentEventCalendarItem } from "./plan-events";

const labels = { withCoach: "Koçunla", cancelled: "İptal edildi" };
const studentId = "student-1";

function event(overrides: Partial<PlanEventDto> = {}): PlanEventDto {
  return {
    id: "event-1",
    seriesId: null,
    organizerUserId: "coach-1",
    orgId: null,
    title: "Haftalık görüşme",
    description: null,
    eventDate: "2026-09-28",
    startTime: "18:00",
    endTime: "18:30",
    status: "SCHEDULED",
    attendeeCount: 1,
    recurrence: null,
    createdAt: "2026-09-27T18:00:00.000Z",
    updatedAt: "2026-09-27T18:00:00.000Z",
    ...overrides,
  };
}

describe("studentEventCalendarItem", () => {
  it("draws a coach's meeting as an event chip on its own day and time", () => {
    const item = studentEventCalendarItem(event(), studentId, labels);
    expect(item).toMatchObject({
      id: "event-1",
      date: "2026-09-28",
      title: "Haftalık görüşme",
      startTime: "18:00",
      endTime: "18:30",
      glyph: "event",
      meta: "Koçunla",
      muted: false,
      color: planEventNeutralColor,
    });
    expect(item.source.id).toBe("event-1");
  });

  it("stays out of the subject legend", () => {
    expect(studentEventCalendarItem(event(), studentId, labels).groupKey).toBeNull();
  });

  it("says nothing about a coach on the student's own event", () => {
    const own = studentEventCalendarItem(event({ organizerUserId: studentId }), studentId, labels);
    expect(own.meta).toBeNull();
  });

  it("fades a cancelled meeting and says so", () => {
    const item = studentEventCalendarItem(event({ status: "CANCELLED" }), studentId, labels);
    expect(item.muted).toBe(true);
    expect(item.hint).toBe("İptal edildi");
  });
});

describe("groupPlanEventsByDate", () => {
  it("keys events by their date", () => {
    const grouped = groupPlanEventsByDate([
      event({ id: "a" }),
      event({ id: "b", eventDate: "2026-09-29" }),
      event({ id: "c" }),
    ]);
    expect(Object.keys(grouped).sort()).toEqual(["2026-09-28", "2026-09-29"]);
    expect(grouped["2026-09-28"]!.map((item) => item.id)).toEqual(["a", "c"]);
  });
});
