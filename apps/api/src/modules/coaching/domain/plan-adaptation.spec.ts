import { describe, expect, it } from "vitest";
import { applyPlanAdaptationSchema } from "@mentor/validation";
import { buildPlanRevision } from "./plan-adaptation";

const task = {
  id: "t1",
  taskDate: "2026-07-21",
  title: "Paragraf: 20 soru",
  subject: "Türkçe",
  status: "PENDING",
  sortOrder: 0,
  updatedAt: new Date("2026-07-21T10:00:00.000Z"),
};

describe("buildPlanRevision", () => {
  it("is stable across row order", () => {
    const second = { ...task, id: "t2", sortOrder: 1 };
    expect(buildPlanRevision([task, second])).toBe(
      buildPlanRevision([second, task]),
    );
  });

  it("changes when plan content changes", () => {
    expect(buildPlanRevision([task])).not.toBe(
      buildPlanRevision([{ ...task, taskDate: "2026-07-22" }]),
    );
  });
});

describe("applyPlanAdaptationSchema", () => {
  it("accepts a selected move and add", () => {
    expect(
      applyPlanAdaptationSchema.safeParse({
        planRevision: "a".repeat(64),
        changes: [
          {
            kind: "MOVE",
            taskId: "00000000-0000-4000-8000-000000000001",
            title: "Paragraf",
            subject: "Türkçe",
            fromDate: "2026-07-21",
            toDate: "2026-07-22",
          },
          {
            kind: "ADD",
            title: "Tekrar",
            subject: null,
            taskDate: "2026-07-23",
          },
        ],
      }).success,
    ).toBe(true);
  });

  it("rejects empty or oversized selections", () => {
    const base = { planRevision: "a".repeat(64) };
    expect(
      applyPlanAdaptationSchema.safeParse({ ...base, changes: [] }).success,
    ).toBe(false);
    expect(
      applyPlanAdaptationSchema.safeParse({
        ...base,
        changes: Array.from({ length: 6 }, (_, index) => ({
          kind: "ADD",
          title: `Task ${index}`,
          subject: null,
          taskDate: "2026-07-23",
        })),
      }).success,
    ).toBe(false);
  });
});
