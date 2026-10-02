import { describe, expect, it } from "vitest";
import {
  createPlanTaskSchema,
  updatePlanTaskSchema,
  startStudySessionSchema,
  applyPlanAdaptationSchema,
} from "@mentor/validation";
import { toPlanTaskDto } from "./modules/coaching/application/coaching.mappers";
import type { PlanTaskRow } from "./modules/coaching/infrastructure/plan-task.repository";

describe("plan task duration contract", () => {
  it.each([5, 41, 80, 200])(
    "retains %i minutes on create and update",
    (minutes) => {
      expect(
        createPlanTaskSchema.parse({
          title: "Review",
          durationMinutes: minutes,
        }),
      ).toHaveProperty("durationMinutes", minutes);
      expect(
        updatePlanTaskSchema.parse({ durationMinutes: minutes }),
      ).toHaveProperty("durationMinutes", minutes);
      expect(
        startStudySessionSchema.safeParse({
          preset: "custom",
          focusMinutes: minutes,
        }).success,
      ).toBe(true);
    },
  );

  it.each([4, 201, 5.5, "invalid"])(
    "rejects invalid duration %s",
    (minutes) => {
      expect(
        createPlanTaskSchema.safeParse({
          title: "Review",
          durationMinutes: minutes,
        }).success,
      ).toBe(false);
      expect(
        startStudySessionSchema.safeParse({
          preset: "custom",
          focusMinutes: minutes,
        }).success,
      ).toBe(false);
    },
  );

  it("keeps omission distinct from explicitly clearing a duration", () => {
    expect(updatePlanTaskSchema.parse({ title: "Review" })).not.toHaveProperty(
      "durationMinutes",
    );
    expect(
      updatePlanTaskSchema.parse({ durationMinutes: null }),
    ).toHaveProperty("durationMinutes", null);
  });

  it("retains the calculated duration when a plan preview is accepted", () => {
    const parsed = applyPlanAdaptationSchema.parse({
      planRevision: "a".repeat(64),
      changes: [
        {
          kind: "ADD",
          title: "Review",
          subject: null,
          taskDate: "2026-10-02",
          durationMinutes: 41,
        },
      ],
    });
    expect(parsed.changes[0]).toHaveProperty("durationMinutes", 41);
  });

  it.each([
    [80, "09:00:00", "11:00:00", 80],
    [null, "09:00:00", "09:41:00", 41],
    [null, "09:00:00", "12:20:00", 200],
    [null, "09:00:00", "13:00:00", null],
    [null, null, null, null],
  ])(
    "resolves explicit %s and calendar %s–%s to %i minutes",
    (duration, start, end, expected) => {
      const row = {
        durationMinutes: duration,
        startTime: start,
        endTime: end,
      } as PlanTaskRow;
      expect(toPlanTaskDto(row)).toMatchObject({
        durationMinutes: duration,
        sessionFocusMinutes: expected,
      });
    },
  );
});

it("accepts stopwatch sessions without a countdown duration", () => {
  expect(
    startStudySessionSchema.safeParse({ preset: "stopwatch" }).success,
  ).toBe(true);
  expect(
    startStudySessionSchema.safeParse({ preset: "stopwatch", focusMinutes: 25 })
      .success,
  ).toBe(false);
});
