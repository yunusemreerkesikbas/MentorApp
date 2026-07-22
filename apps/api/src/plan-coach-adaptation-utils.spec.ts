import { describe, expect, it } from "vitest";
import {
  flattenPlanAdaptationChanges,
  parsePlanAdaptationQuery,
  selectedPlanAdaptationChanges,
} from "../../web/src/lib/plan-coach-adaptation-utils";

describe("coach plan adaptation helpers", () => {
  const changes = [
    {
      kind: "MOVE" as const,
      taskId: "task-1",
      title: "Matematik çöz",
      subject: "Matematik",
      fromDate: "2026-07-21",
      toDate: "2026-07-23",
    },
    {
      kind: "ADD" as const,
      title: "Kısa tekrar",
      subject: null,
      taskDate: "2026-07-22",
    },
  ];

  it("keeps preview order and returns only checked changes", () => {
    const rows = flattenPlanAdaptationChanges(changes);
    expect(rows.map((row) => row.date)).toEqual(["2026-07-23", "2026-07-22"]);
    expect(
      selectedPlanAdaptationChanges(rows, new Set([rows[1]!.key])),
    ).toEqual([changes[1]]);
  });

  it("accepts only valid one-shot contextual query shapes", () => {
    expect(
      parsePlanAdaptationQuery({
        coach: "adapt",
        source: "mood",
        sessionId: null,
      }),
    ).toEqual({ source: "MOOD" });
    expect(
      parsePlanAdaptationQuery({
        coach: "adapt",
        source: "session",
        sessionId: "dd9974b8-b010-4df8-a4fa-3d6bbd17e75d",
      }),
    ).toEqual({
      source: "SESSION",
      sessionId: "dd9974b8-b010-4df8-a4fa-3d6bbd17e75d",
    });
    expect(
      parsePlanAdaptationQuery({
        coach: "adapt",
        source: "session",
        sessionId: null,
      }),
    ).toBeNull();
  });
});
