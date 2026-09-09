import { describe, expect, it } from "vitest";
import { z } from "zod";
import * as validation from "@mentor/validation";

type ValidationSurface = {
  createPlanEventSchema?: z.ZodTypeAny;
  updatePlanEventSchema?: z.ZodTypeAny;
  cancelPlanEventSchema?: z.ZodTypeAny;
  createMentorshipBatchAssignmentSchema?: z.ZodTypeAny;
};

const schemas = validation as ValidationSurface;
const firstStudentId = "00000000-0000-4000-8000-000000000001";
const secondStudentId = "00000000-0000-4000-8000-000000000002";

describe("coach plan event validation", () => {
  it("accepts a strict recurring event and caps recurrence at 100 occurrences", () => {
    expect(schemas.createPlanEventSchema).toBeDefined();
    if (!schemas.createPlanEventSchema) return;

    const event = {
      title: "Haftalık çalışma buluşması",
      description: "Bu hafta birlikte ilerleyelim.",
      eventDate: "2026-09-14",
      startTime: "18:00",
      endTime: "19:00",
      attendeeIds: [firstStudentId, secondStudentId],
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
});
