import { describe, expect, it } from "vitest";
import { COMPLETION_STAR_TOTAL, sessionStarFill } from "./completion-stars";

const PLANNED_25 = 25 * 60;

describe("sessionStarFill", () => {
  it("fills all stars when elapsed meets planned", () => {
    expect(
      sessionStarFill({
        elapsedSec: PLANNED_25,
        plannedSec: PLANNED_25,
        countsAsFocusSession: true,
      }),
    ).toBe(COMPLETION_STAR_TOTAL);
  });

  it("uses half steps at mid-duration", () => {
    expect(
      sessionStarFill({
        elapsedSec: PLANNED_25 / 2,
        plannedSec: PLANNED_25,
        countsAsFocusSession: true,
      }),
    ).toBe(1.5);
  });

  it("clamps overtime to three stars", () => {
    expect(
      sessionStarFill({
        elapsedSec: PLANNED_25 * 2,
        plannedSec: PLANNED_25,
        countsAsFocusSession: true,
      }),
    ).toBe(3);
  });

  it("never returns 0 for a completed focus session", () => {
    expect(
      sessionStarFill({
        elapsedSec: 0,
        plannedSec: PLANNED_25,
        countsAsFocusSession: true,
      }),
    ).toBe(1);
  });

  it("forces 1 star for too-short sessions that are not abandoned", () => {
    expect(
      sessionStarFill({
        elapsedSec: 90,
        plannedSec: PLANNED_25,
        countsAsFocusSession: false,
        abandoned: false,
      }),
    ).toBe(1);
  });

  it("still uses the ratio for an abandoned session", () => {
    expect(
      sessionStarFill({
        elapsedSec: PLANNED_25 * 0.8,
        plannedSec: PLANNED_25,
        countsAsFocusSession: false,
        abandoned: true,
      }),
    ).toBe(2.5);
  });

  it("treats missing planned duration as a full fill when elapsed is present", () => {
    expect(
      sessionStarFill({
        elapsedSec: 600,
        plannedSec: 0,
        countsAsFocusSession: true,
      }),
    ).toBe(3);
  });
});
