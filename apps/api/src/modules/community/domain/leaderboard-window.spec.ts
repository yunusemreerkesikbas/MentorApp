import { describe, expect, it } from "vitest";
import {
  computeMovement,
  previousWindowStart,
  resolveMovement,
  toWindow,
  windowStart,
} from "./leaderboard-window";

const IST = 3 * 60 * 60 * 1000;
/** Istanbul wall-clock fields of a UTC instant (offset baked into UTC getters). */
const ist = (d: Date) => new Date(d.getTime() + IST);

describe("leaderboard-window", () => {
  it("coerces unknown query values to weekly", () => {
    expect(toWindow("today")).toBe("today");
    expect(toWindow("all_time")).toBe("all_time");
    expect(toWindow("weekly")).toBe("weekly");
    expect(toWindow("garbage")).toBe("weekly");
    expect(toWindow(undefined)).toBe("weekly");
  });

  it("all_time starts at the epoch", () => {
    expect(windowStart("all_time").getTime()).toBe(0);
  });

  it("today starts at Istanbul midnight of the current Istanbul day", () => {
    const now = new Date("2026-07-04T05:30:00Z"); // Istanbul 08:30
    const start = windowStart("today", now);
    expect(ist(start).getUTCHours()).toBe(0);
    expect(ist(start).getUTCMinutes()).toBe(0);
    expect(start.getTime()).toBeLessThanOrEqual(now.getTime());
  });

  it("uses the Istanbul day even just after Istanbul midnight (UTC is still the previous day)", () => {
    const now = new Date("2026-07-03T21:30:00Z"); // Istanbul 2026-07-04 00:30
    const start = windowStart("today", now);
    expect(ist(start).getUTCDate()).toBe(4); // July 4 in Istanbul, though UTC says July 3
    expect(start.toISOString()).toBe("2026-07-03T21:00:00.000Z");
  });

  it("weekly starts on Monday 00:00 Istanbul, not after today", () => {
    const now = new Date("2026-07-04T05:30:00Z");
    const weekly = windowStart("weekly", now);
    expect(ist(weekly).getUTCDay()).toBe(1); // Monday
    expect(ist(weekly).getUTCHours()).toBe(0);
    expect(weekly.getTime()).toBeLessThanOrEqual(windowStart("today", now).getTime());
  });

  it("previousWindowStart steps back exactly one period; null for all_time", () => {
    const cur = windowStart("weekly", new Date("2026-07-04T05:30:00Z"));
    expect(previousWindowStart("weekly", cur)!.getTime()).toBe(cur.getTime() - 7 * 86_400_000);
    expect(previousWindowStart("today", cur)!.getTime()).toBe(cur.getTime() - 86_400_000);
    expect(previousWindowStart("all_time", cur)).toBeNull();
  });

  it("computeMovement: lower rank = up, higher = down, missing = new", () => {
    expect(computeMovement(undefined, 5)).toBe("new");
    expect(computeMovement(8, 5)).toBe("up"); // was 8th, now 5th
    expect(computeMovement(3, 5)).toBe("down");
    expect(computeMovement(5, 5)).toBe("same");
  });

  it("resolveMovement suppresses noise when there is no prior-period baseline", () => {
    expect(resolveMovement(null, "u", 3)).toBeNull(); // all_time
    expect(resolveMovement(new Map(), "u", 3)).toBeNull(); // first week — no "new" spam
    const prev = new Map([["u", 5]]);
    expect(resolveMovement(prev, "u", 3)).toBe("up");
    expect(resolveMovement(prev, "other", 3)).toBe("new"); // absent from a real baseline
  });
});
