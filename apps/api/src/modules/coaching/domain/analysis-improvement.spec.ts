import { describe, expect, it } from "vitest";
import {
  analysisCycleSteps,
  selectFirstComparableFollowUp,
  toSharePercent,
} from "./analysis-improvement";

describe("analysis improvement rules", () => {
  it("rounds a signal's share of its explicit denominator", () => {
    expect(toSharePercent(2, 3)).toBe(67);
    expect(toSharePercent(0, 3)).toBe(0);
    expect(toSharePercent(4, 0)).toBe(0);
  });

  it("selects the first same-subject attempt created after the plan and dated after baseline", () => {
    const followUp = selectFirstComparableFollowUp(
      [
        {
          mockExamId: "created-too-early",
          subjectRef: "matematik",
          takenAt: new Date("2026-08-20T12:00:00.000Z"),
          createdAt: new Date("2026-08-09T12:00:00.000Z"),
          net: "27.00",
        },
        {
          mockExamId: "wrong-subject",
          subjectRef: "turkce",
          takenAt: new Date("2026-08-12T12:00:00.000Z"),
          createdAt: new Date("2026-08-12T13:00:00.000Z"),
          net: "24.00",
        },
        {
          mockExamId: "same-day",
          subjectRef: "matematik",
          takenAt: new Date("2026-08-01T18:00:00.000Z"),
          createdAt: new Date("2026-08-12T13:00:00.000Z"),
          net: "26.50",
        },
        {
          mockExamId: "later",
          subjectRef: "matematik",
          takenAt: new Date("2026-08-18T12:00:00.000Z"),
          createdAt: new Date("2026-08-18T13:00:00.000Z"),
          net: "29.00",
        },
        {
          mockExamId: "first",
          subjectRef: "matematik",
          takenAt: new Date("2026-08-15T12:00:00.000Z"),
          createdAt: new Date("2026-08-15T13:00:00.000Z"),
          net: "28.25",
        },
      ],
      {
        subjectRef: "matematik",
        baselineTakenAt: new Date("2026-08-01T12:00:00.000Z"),
        planCreatedAt: new Date("2026-08-10T12:00:00.000Z"),
      },
    );

    expect(followUp).toMatchObject({
      mockExamId: "first",
      net: "28.25",
    });
  });

  it("keeps repetition and measurement as independent facts", () => {
    expect(
      analysisCycleSteps({
        taskStatus: "PENDING",
        reviewedAfterPlanCount: 1,
        hasFollowUp: false,
      }),
    ).toEqual({ planned: true, practiced: true, measured: false, closed: false });

    expect(
      analysisCycleSteps({
        taskStatus: "DONE",
        reviewedAfterPlanCount: 0,
        hasFollowUp: true,
      }),
    ).toEqual({ planned: true, practiced: true, measured: true, closed: true });

    expect(
      analysisCycleSteps({
        taskStatus: "PENDING",
        reviewedAfterPlanCount: 0,
        hasFollowUp: true,
      }),
    ).toEqual({ planned: true, practiced: false, measured: true, closed: false });
  });
});
