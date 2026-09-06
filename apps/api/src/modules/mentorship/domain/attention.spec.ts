import { describe, expect, it } from "vitest";
import { MentorshipRiskFlag, type MentorshipRiskFlagId } from "@mentor/types";
import { needsAttention } from "./attention";

const NOW = new Date("2026-09-10T09:00:00.000Z");
const TTL_DAYS = 7;

/** `days` before NOW. */
const ago = (days: number) => new Date(NOW.getTime() - days * 86_400_000);

const INACTIVE = MentorshipRiskFlag.INACTIVE;
const LOW_MOOD = MentorshipRiskFlag.LOW_MOOD;
const NET_DROP = MentorshipRiskFlag.NET_DROP;

const check = (
  flags: MentorshipRiskFlagId[],
  attendedAt: Date | null,
  attendedFlags: MentorshipRiskFlagId[] = [],
) => needsAttention(flags, attendedAt, attendedFlags, TTL_DAYS, NOW);

describe("needsAttention", () => {
  it("is false for a calm student, marked or not", () => {
    expect(check([], null)).toBe(false);
    expect(check([], ago(1), [INACTIVE])).toBe(false);
  });

  it("is true for a flagged student nobody has marked", () => {
    expect(check([INACTIVE], null)).toBe(true);
  });

  it("is false right after the coach marks the flags on screen", () => {
    expect(check([INACTIVE, LOW_MOOD], ago(0), [INACTIVE, LOW_MOOD])).toBe(false);
  });

  it("ignores flags that have since cleared", () => {
    // Marked two, one recovered. The remaining one is still covered by the mark.
    expect(check([INACTIVE], ago(1), [INACTIVE, LOW_MOOD])).toBe(false);
  });

  describe("a flag the mark never covered", () => {
    it("comes back the same day", () => {
      expect(check([INACTIVE, NET_DROP], ago(0), [INACTIVE])).toBe(true);
    });

    it("comes back even when the mark is fresh", () => {
      expect(check([NET_DROP], ago(1), [INACTIVE, LOW_MOOD])).toBe(true);
    });
  });

  describe("the mark going stale", () => {
    it("still holds one day short of the ttl", () => {
      expect(check([INACTIVE], ago(6), [INACTIVE])).toBe(false);
    });

    it("expires exactly at the ttl", () => {
      expect(check([INACTIVE], ago(7), [INACTIVE])).toBe(true);
    });

    it("expires past it", () => {
      expect(check([INACTIVE], ago(30), [INACTIVE])).toBe(true);
    });
  });

  it("treats an empty mark set as covering nothing", () => {
    // Marked while calm, flagged afterwards: the mark says nothing about this flag.
    expect(check([INACTIVE], ago(1), [])).toBe(true);
  });
});
