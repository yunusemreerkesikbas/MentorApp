import { describe, expect, it } from "vitest";
import type { CoachPlanItemDto } from "@mentor/types";
import {
  coachPlanQueryKey,
  coachPlanQueryTransition,
  coachPlanRange,
  coachPlanWeekdayLabels,
  isCoachPlanItemShared,
  itemsForCoachPlanDay,
  parseCoachPlanSelection,
  sortCoachPlanItems,
  uniqueStudentAvatars,
} from "./coach-plan-calendar";

function task(
  id: string,
  taskDate: string,
  startTime: string | null,
  participants: Array<{
    studentId: string;
    studentDisplayName: string;
    avatarUrl: string | null;
  }> = [],
): CoachPlanItemDto {
  return {
    kind: "TASK",
    task: {
      id,
      assignmentGroupId: null,
      taskDate,
      title: id,
      subject: null,
      topic: null,
      startTime,
      endTime: null,
      coachNote: null,
      participants: participants.map((participant) => ({
        ...participant,
        studentUsername: null,
        taskId: `${id}:${participant.studentId}`,
        status: "PENDING",
      })),
    },
  };
}

function event(
  id: string,
  eventDate: string,
  startTime: string | null,
  attendees: Array<{
    studentId: string;
    studentDisplayName: string;
    avatarUrl: string | null;
  }> = [],
): CoachPlanItemDto {
  return {
    kind: "EVENT",
    event: {
      id,
      seriesId: null,
      organizerUserId: "coach",
      orgId: null,
      title: id,
      description: null,
      eventDate,
      startTime,
      endTime: null,
      status: "SCHEDULED",
      attendeeCount: attendees.length,
      recurrence: null,
      createdAt: "2026-09-01T00:00:00.000Z",
      updatedAt: "2026-09-01T00:00:00.000Z",
      attendees: attendees.map((attendee) => ({
        ...attendee,
        studentUsername: null,
      })),
    },
  };
}

describe("coachPlanRange", () => {
  it("returns a Monday-first seven-day week", () => {
    expect(coachPlanRange("2026-09-09", "week")).toEqual({
      from: "2026-09-07",
      to: "2026-09-13",
      days: [
        "2026-09-07",
        "2026-09-08",
        "2026-09-09",
        "2026-09-10",
        "2026-09-11",
        "2026-09-12",
        "2026-09-13",
      ],
    });
  });

  it("returns the complete 42-day month board", () => {
    const range = coachPlanRange("2026-09-09", "month");
    expect(range.days).toHaveLength(42);
    expect(range.from).toBe("2026-08-31");
    expect(range.to).toBe("2026-10-11");
  });
});

describe("sortCoachPlanItems", () => {
  it("orders tasks and events by date then time while preserving ties", () => {
    const input = [
      event("event-late", "2026-09-10", "15:00"),
      task("task-first-tie", "2026-09-10", "09:00"),
      event("event-second-tie", "2026-09-10", "09:00"),
      task("all-day", "2026-09-09", null),
    ];

    expect(sortCoachPlanItems(input).map((item) => item.kind === "TASK" ? item.task.id : item.event.id))
      .toEqual(["all-day", "task-first-tie", "event-second-tie", "event-late"]);
  });
});

describe("coach plan day summaries", () => {
  it("extracts unique student avatars in first-seen order with an overflow count", () => {
    const ayse = { studentId: "a", studentDisplayName: "Ayşe", avatarUrl: "/a.png" };
    const bora = { studentId: "b", studentDisplayName: "Bora", avatarUrl: null };
    const can = { studentId: "c", studentDisplayName: "Can", avatarUrl: "/c.png" };
    const deniz = { studentId: "d", studentDisplayName: "Deniz", avatarUrl: "/d.png" };
    const items = [
      task("one", "2026-09-09", null, [ayse, bora]),
      event("two", "2026-09-09", "10:00", [ayse, can, deniz]),
    ];

    expect(uniqueStudentAvatars(items, 3)).toEqual({
      students: [ayse, bora, can],
      overflow: 1,
      total: 4,
      allNames: ["Ayşe", "Bora", "Can", "Deniz"],
    });
  });

  it("retains personal items that have no student avatar", () => {
    const personalTask = task("personal", "2026-09-09", null);
    const personalEvent = event("private", "2026-09-09", "12:00");

    expect(itemsForCoachPlanDay([personalTask, personalEvent], "2026-09-09"))
      .toEqual([personalTask, personalEvent]);
    expect(uniqueStudentAvatars([personalTask, personalEvent], 3)).toEqual({
      students: [],
      overflow: 0,
      total: 0,
      allNames: [],
    });
  });

  it("uses attendeeCount to retain shared semantics when attendee identities are redacted", () => {
    const redacted = event("historical", "2026-09-09", "12:00");
    if (redacted.kind === "EVENT") redacted.event.attendeeCount = 2;

    expect(isCoachPlanItemShared(redacted)).toBe(true);
    expect(uniqueStudentAvatars([redacted], 3)).toMatchObject({
      total: 0,
      allNames: [],
    });
  });
});

describe("parseCoachPlanSelection", () => {
  it("accepts a valid in-range date and event deep link", () => {
    expect(parseCoachPlanSelection(
      { date: "2026-09-10", event: "event-1" },
      { from: "2026-09-07", to: "2026-09-13" },
    )).toEqual({ date: "2026-09-10", eventId: "event-1" });
  });

  it("drops malformed or out-of-range selection values", () => {
    expect(parseCoachPlanSelection(
      { date: "2026-09-31", event: " " },
      { from: "2026-09-07", to: "2026-09-13" },
    )).toEqual({ date: null, eventId: null });
  });
});

describe("coachPlanQueryTransition", () => {
  it("derives fresh anchor and selection state for each same-route query transition", () => {
    expect(coachPlanQueryTransition({ date: "2026-09-10", event: "first" })).toEqual({
      anchor: "2026-09-10",
      selectedDate: "2026-09-10",
      eventId: "first",
    });
    expect(coachPlanQueryTransition({ date: "2026-10-22", event: "second" })).toEqual({
      anchor: "2026-10-22",
      selectedDate: "2026-10-22",
      eventId: "second",
    });
  });

  it("rejects an invalid transition date", () => {
    expect(coachPlanQueryTransition({ date: "2026-09-31", event: "event" })).toBeNull();
  });

  it("keeps the query key stable until date or event actually changes", () => {
    const query = { date: "2026-09-10", event: "first" };
    expect(coachPlanQueryKey(query)).toBe(coachPlanQueryKey({ ...query }));
    expect(coachPlanQueryKey({ ...query, date: "2026-09-11" })).not.toBe(
      coachPlanQueryKey(query),
    );
    expect(coachPlanQueryKey({ ...query, event: "second" })).not.toBe(
      coachPlanQueryKey(query),
    );
  });
});

describe("coachPlanWeekdayLabels", () => {
  it("returns seven locale-aware headings starting on Monday", () => {
    expect(coachPlanWeekdayLabels("en-US", "short")).toEqual([
      "Mon",
      "Tue",
      "Wed",
      "Thu",
      "Fri",
      "Sat",
      "Sun",
    ]);
  });
});
