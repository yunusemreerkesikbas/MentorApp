import { describe, expect, it } from "vitest";
import { hasSevenFullIstanbulDaysBetween } from "./achievement-evidence";

describe("hasSevenFullIstanbulDaysBetween", () => {
  it("accepts seven complete Istanbul calendar days between sessions", () => {
    expect(hasSevenFullIstanbulDaysBetween(
      new Date("2026-08-01T20:30:00Z"),
      new Date("2026-08-09T00:01:00Z"),
    )).toBe(true);
  });

  it("rejects when only six complete calendar days sit between sessions", () => {
    expect(hasSevenFullIstanbulDaysBetween(
      new Date("2026-08-01T20:30:00Z"),
      new Date("2026-08-08T20:29:00Z"),
    )).toBe(false);
  });
});
