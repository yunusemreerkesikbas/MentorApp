import { describe, expect, it } from "vitest";
import { nextPeriodEnd } from "./subscriptions.service";

const MONTH = 1;
const addMonths = (d: Date, m: number) => {
  const x = new Date(d);
  x.setMonth(x.getMonth() + m);
  return x;
};

describe("nextPeriodEnd (renewal period base — review #2)", () => {
  const now = new Date("2026-06-12T10:00:00Z");

  it("extends from the current period end when it is still in the future (late webhook)", () => {
    // Renewal webhook arrives 2 days before the period ends → must NOT lose those days.
    const periodEnd = new Date("2026-06-14T10:00:00Z");
    expect(nextPeriodEnd(now, periodEnd, MONTH).getTime()).toBe(addMonths(periodEnd, MONTH).getTime());
  });

  it("extends from now when the period already expired", () => {
    const expired = new Date("2026-06-01T10:00:00Z");
    expect(nextPeriodEnd(now, expired, MONTH).getTime()).toBe(addMonths(now, MONTH).getTime());
  });

  it("extends from now when there is no prior period (first charge)", () => {
    expect(nextPeriodEnd(now, null, MONTH).getTime()).toBe(addMonths(now, MONTH).getTime());
  });

  it("never shortens already-paid time", () => {
    const farEnd = new Date("2026-09-12T10:00:00Z");
    expect(nextPeriodEnd(now, farEnd, MONTH).getTime()).toBeGreaterThan(farEnd.getTime());
  });
});
