import { describe, expect, it } from "vitest";
import {
  buildSeansHrefFromPlanTask,
  parsePlanTaskContextFromParams,
  PLAN_TASK_TITLE_MAX,
} from "../../web/src/lib/plan-seans-link";

const TASK_ID = "5523a9e3-8a12-4547-a998-181548f2a15a";

describe("buildSeansHrefFromPlanTask", () => {
  it("includes subject, taskTitle, and taskId when all are present", () => {
    expect(
      buildSeansHrefFromPlanTask({
        id: TASK_ID,
        title: "Paragraf tekrarı",
        subject: "Türkçe",
      }),
    ).toEqual({
      pathname: "/seans",
      query: {
        taskId: TASK_ID,
        taskTitle: "Paragraf tekrarı",
        subject: "Türkçe",
      },
    });
  });

  it("omits subject when the task has none", () => {
    expect(
      buildSeansHrefFromPlanTask({
        id: TASK_ID,
        title: "Genel tekrar",
        subject: null,
      }),
    ).toEqual({
      pathname: "/seans",
      query: {
        taskId: TASK_ID,
        taskTitle: "Genel tekrar",
      },
    });
  });

  it("truncates long titles to the validation max", () => {
    const longTitle = "a".repeat(PLAN_TASK_TITLE_MAX + 20);
    const href = buildSeansHrefFromPlanTask({
      id: TASK_ID,
      title: longTitle,
      subject: null,
    });
    expect(href).toMatchObject({
      pathname: "/seans",
      query: {
        taskTitle: "a".repeat(PLAN_TASK_TITLE_MAX),
      },
    });
  });

  it("trims whitespace from title and subject", () => {
    expect(
      buildSeansHrefFromPlanTask({
        id: TASK_ID,
        title: "  Tarih özeti  ",
        subject: "  Tarih  ",
      }),
    ).toEqual({
      pathname: "/seans",
      query: {
        taskId: TASK_ID,
        taskTitle: "Tarih özeti",
        subject: "Tarih",
      },
    });
  });
});

describe("parsePlanTaskContextFromParams", () => {
  it("returns parsed title and valid task id", () => {
    expect(
      parsePlanTaskContextFromParams({
        taskTitle: "Paragraf tekrarı",
        taskId: TASK_ID,
      }),
    ).toEqual({
      taskTitle: "Paragraf tekrarı",
      taskId: TASK_ID,
    });
  });

  it("rejects invalid task ids", () => {
    expect(
      parsePlanTaskContextFromParams({
        taskTitle: "Paragraf tekrarı",
        taskId: "not-a-uuid",
      }),
    ).toEqual({
      taskTitle: "Paragraf tekrarı",
      taskId: null,
    });
  });

  it("returns null context when params are empty", () => {
    expect(
      parsePlanTaskContextFromParams({
        taskTitle: null,
        taskId: null,
      }),
    ).toEqual({
      taskTitle: null,
      taskId: null,
    });
  });

  it("truncates oversized titles on parse", () => {
    const longTitle = "b".repeat(PLAN_TASK_TITLE_MAX + 10);
    expect(
      parsePlanTaskContextFromParams({
        taskTitle: longTitle,
        taskId: TASK_ID,
      }).taskTitle,
    ).toHaveLength(PLAN_TASK_TITLE_MAX);
  });
});
