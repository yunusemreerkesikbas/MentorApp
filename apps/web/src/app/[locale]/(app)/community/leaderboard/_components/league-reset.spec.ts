import { describe, expect, it } from "vitest";
import { nextLeagueReset } from "./league-reset";

describe("nextLeagueReset", () => {
  // Wednesday 2026-10-07 23:30 in Istanbul (20:30 UTC).
  const now = new Date("2026-10-07T20:30:00.000Z");

  it("starts today's league over at the next Istanbul midnight", () => {
    expect(nextLeagueReset("today", now)?.toISOString()).toBe("2026-10-07T21:00:00.000Z");
  });

  it("starts the weekly league over on Monday 00:00 Istanbul", () => {
    expect(nextLeagueReset("weekly", now)?.toISOString()).toBe("2026-10-11T21:00:00.000Z");
  });

  it("never resets the all-time league", () => {
    expect(nextLeagueReset("all_time", now)).toBeNull();
  });
});
