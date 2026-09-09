import { describe, expect, it } from "vitest";
import { z } from "zod";
import * as validation from "@mentor/validation";

type ValidationSurface = {
  createPlanEventSchema?: z.ZodTypeAny;
  updatePlanEventSchema?: z.ZodTypeAny;
  cancelPlanEventSchema?: z.ZodTypeAny;
  createMentorshipBatchAssignmentSchema?: z.ZodTypeAny;
  updateMentorshipAssignmentSchema?: z.ZodTypeAny;
  updateMentorshipAssignmentGroupSchema?: z.ZodTypeAny;
  removeMentorshipAssignmentGroupSchema?: z.ZodTypeAny;
};

const schemas = validation as ValidationSurface;
const firstStudentId = "00000000-0000-4000-8000-000000000001";
const secondStudentId = "00000000-0000-4000-8000-000000000002";
const attendeeIds = Array.from(
  { length: 21 },
  (_, index) =>
    `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
);
const recurringEvent = {
  title: "Haftalık çalışma buluşması",
  description: "Bu hafta birlikte ilerleyelim.",
  eventDate: "2026-09-14",
  startTime: "18:00",
  endTime: "19:00",
  attendeeIds: [firstStudentId, secondStudentId],
};
const expectedTaskSignature = {
  taskDate: "2026-09-15",
  title: "Paragraf",
  subject: "Türkçe",
  topic: null,
  startTime: null,
  endTime: null,
  coachNote: "20 soru",
};

describe("coach plan event validation", () => {
  it("accepts a strict recurring event and caps recurrence at 100 occurrences", () => {
    expect(schemas.createPlanEventSchema).toBeDefined();
    if (!schemas.createPlanEventSchema) return;

    const event = {
      ...recurringEvent,
      recurrence: {
        frequency: "WEEKLY",
        end: { kind: "COUNT", count: 100 },
      },
    };

    expect(schemas.createPlanEventSchema.safeParse(event).success).toBe(true);
    expect(
      schemas.createPlanEventSchema.safeParse({
        ...event,
        recurrence: {
          frequency: "WEEKLY",
          end: { kind: "COUNT", count: 101 },
        },
      }).success,
    ).toBe(false);
    expect(
      schemas.createPlanEventSchema.safeParse({
        ...event,
        attendeeIds: [firstStudentId, firstStudentId],
      }).success,
    ).toBe(false);
    expect(
      schemas.createPlanEventSchema.safeParse({ ...event, unexpected: true })
        .success,
    ).toBe(false);
  });

  it.each(["DAILY", "MONTHLY"] as const)(
    "accepts %s recurrence with a valid DATE ending",
    (frequency) => {
      expect(schemas.createPlanEventSchema).toBeDefined();
      if (!schemas.createPlanEventSchema) return;

      expect(
        schemas.createPlanEventSchema.safeParse({
          ...recurringEvent,
          recurrence: {
            frequency,
            end: { kind: "DATE", date: "2026-10-14" },
          },
        }).success,
      ).toBe(true);
    },
  );

  it("rejects create DATE recurrence endings before eventDate", () => {
    expect(schemas.createPlanEventSchema).toBeDefined();
    if (!schemas.createPlanEventSchema) return;

    const recurrence = {
      frequency: "DAILY",
      end: { kind: "DATE", date: "2026-09-13" },
    };
    expect(
      schemas.createPlanEventSchema.safeParse({
        ...recurringEvent,
        recurrence,
      }).success,
    ).toBe(false);
  });

  it("rejects update DATE recurrence endings when both dates are supplied", () => {
    expect(schemas.updatePlanEventSchema).toBeDefined();
    if (!schemas.updatePlanEventSchema) return;

    expect(
      schemas.updatePlanEventSchema.safeParse({
        scope: "SERIES",
        eventDate: recurringEvent.eventDate,
        recurrence: {
          frequency: "MONTHLY",
          end: { kind: "DATE", date: "2026-09-13" },
        },
      }).success,
    ).toBe(false);
  });

  it("does not impose the mentorship cohort cap on event attendees", () => {
    expect(schemas.createPlanEventSchema).toBeDefined();
    if (!schemas.createPlanEventSchema) return;

    expect(
      schemas.createPlanEventSchema.safeParse({
        ...recurringEvent,
        attendeeIds,
      }).success,
    ).toBe(true);
  });

  it("requires valid event update and cancellation scopes", () => {
    expect(schemas.updatePlanEventSchema).toBeDefined();
    expect(schemas.cancelPlanEventSchema).toBeDefined();
    if (!schemas.updatePlanEventSchema || !schemas.cancelPlanEventSchema)
      return;

    expect(
      schemas.updatePlanEventSchema.safeParse({
        scope: "OCCURRENCE",
        startTime: "19:00",
        endTime: "18:00",
      }).success,
    ).toBe(false);
    expect(
      schemas.updatePlanEventSchema.safeParse({
        scope: "SERIES",
        title: "Yeni başlık",
      }).success,
    ).toBe(true);
    expect(
      schemas.updatePlanEventSchema.safeParse({ scope: "SERIES" }).success,
    ).toBe(false);
    expect(
      schemas.cancelPlanEventSchema.safeParse({ scope: "OCCURRENCE" }).success,
    ).toBe(true);
    expect(
      schemas.cancelPlanEventSchema.safeParse({
        scope: "OCCURRENCE",
        reason: "not accepted",
      }).success,
    ).toBe(false);
  });

  it("accepts one task for 1..20 unique students without student description", () => {
    expect(schemas.createMentorshipBatchAssignmentSchema).toBeDefined();
    if (!schemas.createMentorshipBatchAssignmentSchema) return;

    const input = {
      studentIds: [firstStudentId, secondStudentId],
      task: {
        title: "Paragraf denemesi çöz",
        taskDate: "2026-09-15",
        coachNote: "Süre tutarak ilerle.",
      },
    };

    expect(
      schemas.createMentorshipBatchAssignmentSchema.safeParse(input).success,
    ).toBe(true);
    expect(
      schemas.createMentorshipBatchAssignmentSchema.safeParse({
        ...input,
        studentIds: [firstStudentId, firstStudentId],
      }).success,
    ).toBe(false);
    expect(
      schemas.createMentorshipBatchAssignmentSchema.safeParse({
        ...input,
        task: { ...input.task, description: "Student-authored field" },
      }).success,
    ).toBe(false);
    expect(
      schemas.createMentorshipBatchAssignmentSchema.safeParse({
        ...input,
        studentIds: Array.from(
          { length: 21 },
          (_, index) =>
            `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
        ),
      }).success,
    ).toBe(false);
  });

  it("limits assignment edits to coach-owned schedule/content fields", () => {
    expect(schemas.updateMentorshipAssignmentSchema).toBeDefined();
    expect(schemas.updateMentorshipAssignmentGroupSchema).toBeDefined();
    if (
      !schemas.updateMentorshipAssignmentSchema ||
      !schemas.updateMentorshipAssignmentGroupSchema
    ) {
      return;
    }
    expect(
      schemas.updateMentorshipAssignmentSchema.safeParse({
        title: "Yeni başlık",
        subject: "Türkçe",
        topic: "Paragraf",
        taskDate: "2026-09-16",
        startTime: "10:00",
        endTime: "11:00",
        coachNote: "20 soru",
      }).success,
    ).toBe(true);
    for (const forbidden of [
      { status: "DONE" },
      { description: "student-private" },
      { origin: null },
      { assignmentGroupId: null },
    ]) {
      expect(
        schemas.updateMentorshipAssignmentSchema.safeParse(forbidden).success,
      ).toBe(false);
    }
    expect(
      schemas.updateMentorshipAssignmentGroupSchema.safeParse({
        studentIds: [firstStudentId],
      }).success,
    ).toBe(false);
  });

  it("requires the visible task signature on group update and delete", () => {
    expect(schemas.updateMentorshipAssignmentGroupSchema).toBeDefined();
    expect(schemas.removeMentorshipAssignmentGroupSchema).toBeDefined();
    if (
      !schemas.updateMentorshipAssignmentGroupSchema ||
      !schemas.removeMentorshipAssignmentGroupSchema
    ) {
      return;
    }
    expect(schemas.updateMentorshipAssignmentGroupSchema.safeParse({
      studentIds: [firstStudentId],
      expectedSignature: expectedTaskSignature,
      title: "Yeni başlık",
    }).success).toBe(true);
    expect(schemas.removeMentorshipAssignmentGroupSchema.safeParse({
      studentIds: [firstStudentId],
      expectedSignature: expectedTaskSignature,
    }).success).toBe(true);
    expect(schemas.updateMentorshipAssignmentGroupSchema.safeParse({
      studentIds: [firstStudentId],
      title: "Yeni başlık",
    }).success).toBe(false);
    expect(schemas.removeMentorshipAssignmentGroupSchema.safeParse({
      studentIds: [firstStudentId],
    }).success).toBe(false);
  });
});
