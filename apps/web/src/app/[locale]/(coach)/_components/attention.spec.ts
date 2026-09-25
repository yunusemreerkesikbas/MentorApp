import { describe, expect, it } from "vitest";
import { daysSinceMark, isAttended, withAttention } from "./attention";

const NOW = new Date("2026-09-24T09:00:00.000Z");

describe("daysSinceMark", () => {
  it("counts days on the Istanbul calendar, not in UTC", () => {
    // 00:30 in Istanbul on the 24th is still the 23rd in UTC.
    expect(daysSinceMark("2026-09-23T21:30:00.000Z", "2026-09-24")).toBe(0);
    // 23:30 in Istanbul on the 23rd.
    expect(daysSinceMark("2026-09-23T20:30:00.000Z", "2026-09-24")).toBe(1);
    expect(daysSinceMark("2026-09-20T09:00:00.000Z", "2026-09-24")).toBe(4);
  });
});

describe("isAttended", () => {
  it("reads a stale mark as not handled, so the coach is offered İlgilendim again", () => {
    // Marked eight days ago; the server says the student is waiting again (TTL or new flags).
    expect(
      isAttended({ needsAttention: true, attendedAt: "2026-09-16T09:00:00.000Z" }),
    ).toBe(false);
  });

  it("holds a mark the server still counts", () => {
    expect(
      isAttended({ needsAttention: false, attendedAt: "2026-09-24T08:00:00.000Z" }),
    ).toBe(true);
  });

  it("is off before the first mark", () => {
    expect(isAttended({ needsAttention: false, attendedAt: null })).toBe(false);
  });
});

describe("withAttention", () => {
  const flagged = { riskFlags: ["INACTIVE"], attendedAt: null, needsAttention: true };

  it("marks a student handled now", () => {
    expect(withAttention(flagged, true, NOW)).toEqual({
      riskFlags: ["INACTIVE"],
      attendedAt: NOW.toISOString(),
      needsAttention: false,
    });
  });

  it("puts a flagged student back in the queue when the mark is taken back", () => {
    const marked = withAttention(flagged, true, NOW);
    expect(withAttention(marked, false, NOW)).toMatchObject({
      attendedAt: null,
      needsAttention: true,
    });
  });

  it("leaves a student with no flags out of the queue either way", () => {
    const calm = { riskFlags: [], attendedAt: NOW.toISOString(), needsAttention: false };
    expect(withAttention(calm, false, NOW).needsAttention).toBe(false);
  });
});
