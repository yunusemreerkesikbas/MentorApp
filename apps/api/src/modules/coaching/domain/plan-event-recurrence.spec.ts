import { describe, expect, it } from "vitest";
import {
  generatePlanEventDates,
  PlanEventRecurrenceError,
} from "./plan-event-recurrence";

describe("generatePlanEventDates", () => {
  it("counts the first DAILY occurrence", () => {
    expect(
      generatePlanEventDates({
        frequency: "DAILY",
        startsOn: "2026-09-09",
        end: { kind: "COUNT", count: 3 },
      }),
    ).toEqual(["2026-09-09", "2026-09-10", "2026-09-11"]);
  });

  it("includes the DATE boundary for WEEKLY recurrence", () => {
    expect(
      generatePlanEventDates({
        frequency: "WEEKLY",
        startsOn: "2026-09-09",
        end: { kind: "DATE", date: "2026-09-23" },
      }),
    ).toEqual(["2026-09-09", "2026-09-16", "2026-09-23"]);
  });

  it("keeps the original monthly anchor after clamping a short month", () => {
    expect(
      generatePlanEventDates({
        frequency: "MONTHLY",
        startsOn: "2025-01-31",
        end: { kind: "COUNT", count: 4 },
      }),
    ).toEqual(["2025-01-31", "2025-02-28", "2025-03-31", "2025-04-30"]);
  });

  it("clamps February to leap day when appropriate", () => {
    expect(
      generatePlanEventDates({
        frequency: "MONTHLY",
        startsOn: "2024-01-31",
        end: { kind: "COUNT", count: 3 },
      }),
    ).toEqual(["2024-01-31", "2024-02-29", "2024-03-31"]);
  });

  it("rejects more than 100 occurrences", () => {
    expect(() =>
      generatePlanEventDates({
        frequency: "DAILY",
        startsOn: "2026-01-01",
        end: { kind: "COUNT", count: 101 },
      }),
    ).toThrowError(
      expect.objectContaining<Partial<PlanEventRecurrenceError>>({
        reason: "TOO_MANY_OCCURRENCES",
      }),
    );
  });

  it("rejects a DATE series beyond twelve calendar months", () => {
    expect(() =>
      generatePlanEventDates({
        frequency: "MONTHLY",
        startsOn: "2026-01-31",
        end: { kind: "DATE", date: "2027-02-01" },
      }),
    ).toThrowError(
      expect.objectContaining<Partial<PlanEventRecurrenceError>>({
        reason: "TOO_LONG",
      }),
    );
  });

  it("rejects a COUNT series whose last occurrence exceeds twelve calendar months", () => {
    expect(() =>
      generatePlanEventDates({
        frequency: "WEEKLY",
        startsOn: "2026-01-01",
        end: { kind: "COUNT", count: 54 },
      }),
    ).toThrowError(
      expect.objectContaining<Partial<PlanEventRecurrenceError>>({
        reason: "TOO_LONG",
      }),
    );
  });

  it("rejects an end date before the effective start", () => {
    expect(() =>
      generatePlanEventDates({
        frequency: "DAILY",
        startsOn: "2026-09-09",
        end: { kind: "DATE", date: "2026-09-08" },
      }),
    ).toThrowError(
      expect.objectContaining<Partial<PlanEventRecurrenceError>>({
        reason: "END_BEFORE_START",
      }),
    );
  });
});
