import { describe, expect, it } from "vitest";
import type { CoachPlanGroupedTaskDto } from "@mentor/types";
import {
  buildCoachEventCreate,
  buildCoachEventUpdate,
  buildCoachTaskCreate,
  buildCoachTaskUpdate,
  eventMutationScope,
  isCoachEventMutable,
  taskMutationTarget,
} from "./coach-plan-mutations";

const STUDENT_A = "00000000-0000-4000-8000-000000000001";
const STUDENT_B = "00000000-0000-4000-8000-000000000002";

function task(
  overrides: Partial<CoachPlanGroupedTaskDto> = {},
): CoachPlanGroupedTaskDto {
  return {
    id: "00000000-0000-4000-8000-000000000010",
    assignmentGroupId: null,
    status: "PENDING",
    taskDate: "2026-09-10",
    title: "Paragraf",
    subject: null,
    topic: null,
    startTime: null,
    endTime: null,
    coachNote: null,
    participants: [],
    ...overrides,
  };
}

describe("buildCoachTaskCreate", () => {
  it("builds a personal task without coach-only or student-authored notes", () => {
    expect(buildCoachTaskCreate({
      title: "  Paragraf  ",
      taskDate: "2026-09-10",
      startTime: "",
      endTime: "",
      coachNote: "Bu not kişisel göreve gitmez",
      attendeeIds: [],
    })).toEqual({
      kind: "PERSONAL",
      input: {
        title: "Paragraf",
        taskDate: "2026-09-10",
        startTime: null,
        endTime: null,
      },
    });
  });

  it("builds one atomic batch payload for every selected student", () => {
    expect(buildCoachTaskCreate({
      title: "Paragraf",
      taskDate: "2026-09-10",
      startTime: "09:00",
      endTime: "10:00",
      coachNote: "  İlk 20 soru  ",
      attendeeIds: [STUDENT_A, STUDENT_B],
    })).toEqual({
      kind: "BATCH",
      input: {
        studentIds: [STUDENT_A, STUDENT_B],
        task: {
          title: "Paragraf",
          taskDate: "2026-09-10",
          startTime: "09:00",
          endTime: "10:00",
          coachNote: "İlk 20 soru",
        },
      },
    });
  });
});

describe("taskMutationTarget", () => {
  it("targets a pending personal task and refuses a done personal task", () => {
    expect(taskMutationTarget(task())).toEqual({
      kind: "PERSONAL",
      taskId: "00000000-0000-4000-8000-000000000010",
    });
    expect(taskMutationTarget(task({ status: "DONE" }))).toBeNull();
  });

  it("targets only the pending participant of an ungrouped assignment", () => {
    expect(taskMutationTarget(task({
      status: null,
      participants: [
        {
          studentId: STUDENT_A,
          studentDisplayName: "Ayşe",
          studentUsername: null,
          avatarUrl: null,
          taskId: "00000000-0000-4000-8000-000000000011",
          status: "DONE",
        },
        {
          studentId: STUDENT_B,
          studentDisplayName: "Bora",
          studentUsername: null,
          avatarUrl: null,
          taskId: "00000000-0000-4000-8000-000000000012",
          status: "PENDING",
        },
      ],
    }))).toEqual({
      kind: "ASSIGNMENT",
      studentId: STUDENT_B,
      taskId: "00000000-0000-4000-8000-000000000012",
    });
  });

  it("targets only displayed pending students in a group", () => {
    const groupedTask = task({
      assignmentGroupId: "00000000-0000-4000-8000-000000000020",
      status: null,
      participants: [
        {
          studentId: STUDENT_A,
          studentDisplayName: "Ayşe",
          studentUsername: null,
          avatarUrl: null,
          taskId: "00000000-0000-4000-8000-000000000011",
          status: "DONE",
        },
        {
          studentId: STUDENT_B,
          studentDisplayName: "Bora",
          studentUsername: null,
          avatarUrl: null,
          taskId: "00000000-0000-4000-8000-000000000012",
          status: "PENDING",
        },
      ],
    });
    const target = taskMutationTarget(groupedTask);
    expect(target).toEqual({
      kind: "GROUP",
      assignmentGroupId: "00000000-0000-4000-8000-000000000020",
      studentIds: [STUDENT_B],
    });
    expect(buildCoachTaskUpdate(target!, {
      title: "  Yeni paragraf ",
      taskDate: "2026-09-11",
      startTime: "",
      endTime: "",
      coachNote: "",
    })).toEqual({
      studentIds: [STUDENT_B],
      title: "Yeni paragraf",
      taskDate: "2026-09-11",
      startTime: null,
      endTime: null,
      coachNote: null,
    });
  });
});

describe("buildCoachEventCreate", () => {
  it("keeps recurrence as one server payload without generated occurrences", () => {
    expect(buildCoachEventCreate({
      title: "Haftalık görüşme",
      description: "  Durum değerlendirmesi  ",
      eventDate: "2026-09-10",
      startTime: "11:00",
      endTime: "",
      attendeeIds: [STUDENT_A],
      recurrenceFrequency: "WEEKLY",
      recurrenceEndKind: "COUNT",
      recurrenceCount: 4,
      recurrenceEndDate: "",
    })).toEqual({
      title: "Haftalık görüşme",
      description: "Durum değerlendirmesi",
      eventDate: "2026-09-10",
      startTime: "11:00",
      endTime: null,
      attendeeIds: [STUDENT_A],
      recurrence: {
        frequency: "WEEKLY",
        end: { kind: "COUNT", count: 4 },
      },
    });
  });

  it("builds a personal non-recurring event from an empty selection", () => {
    expect(buildCoachEventCreate({
      title: "Kendi hazırlığım",
      description: "",
      eventDate: "2026-09-10",
      startTime: "",
      endTime: "",
      attendeeIds: [],
      recurrenceFrequency: "NONE",
      recurrenceEndKind: "DATE",
      recurrenceCount: 2,
      recurrenceEndDate: "2026-09-20",
    })).toMatchObject({
      attendeeIds: [],
      recurrence: null,
    });
  });
});

describe("eventMutationScope", () => {
  it("defaults non-series events to one occurrence", () => {
    expect(eventMutationScope(null, null)).toBe("OCCURRENCE");
  });

  it("requires an explicit scope for a series", () => {
    expect(eventMutationScope("series-1", null)).toBeNull();
    expect(eventMutationScope("series-1", "SERIES")).toBe("SERIES");
  });

  it("allows edits only for scheduled events that are not in the past", () => {
    expect(isCoachEventMutable({ status: "SCHEDULED", eventDate: "2026-09-09" }, "2026-09-09"))
      .toBe(true);
    expect(isCoachEventMutable({ status: "SCHEDULED", eventDate: "2026-09-08" }, "2026-09-09"))
      .toBe(false);
    expect(isCoachEventMutable({ status: "CANCELLED", eventDate: "2026-09-10" }, "2026-09-09"))
      .toBe(false);
  });

  it("builds an event update with the chosen scope and active attendees", () => {
    expect(buildCoachEventUpdate({
      title: "  Yeni görüşme ",
      description: "",
      eventDate: "2026-09-12",
      startTime: "11:00",
      endTime: "11:30",
      attendeeIds: [STUDENT_B],
      recurrenceFrequency: "NONE",
      recurrenceEndKind: "COUNT",
      recurrenceCount: 2,
      recurrenceEndDate: "",
    }, "SERIES")).toEqual({
      scope: "SERIES",
      title: "Yeni görüşme",
      description: null,
      eventDate: "2026-09-12",
      startTime: "11:00",
      endTime: "11:30",
      attendeeIds: [STUDENT_B],
      recurrence: null,
    });
  });

  it("omits recurrence from an occurrence update", () => {
    const update = buildCoachEventUpdate({
      title: "Tek görüşme",
      description: "",
      eventDate: "2026-09-12",
      startTime: "",
      endTime: "",
      attendeeIds: [],
      recurrenceFrequency: "WEEKLY",
      recurrenceEndKind: "COUNT",
      recurrenceCount: 4,
      recurrenceEndDate: "",
    }, "OCCURRENCE");

    expect(update).not.toHaveProperty("recurrence");
    expect(update).toMatchObject({ scope: "OCCURRENCE", attendeeIds: [] });
  });
});
