import { describe, expect, it } from "vitest";
import { recapAllowance, recapMode } from "./weekly-recap-access";

describe("Wrapped acquisition policy", () => {
  it("uses a rolling duration and reports when a slot becomes available", () => {
    const now = new Date("2026-11-01T12:00:00Z");
    const result = recapAllowance([
      new Date("2026-10-01T12:00:00Z"),
      new Date("2026-10-05T12:00:00Z"),
      new Date("2026-10-20T12:00:00Z"),
    ], [], 2, 30, now);
    expect(result).toEqual({ used: 2, remaining: 0, nextAvailableAt: "2026-11-04T12:00:00.000Z" });
  });
  it("reserves a slot for concurrent generation and handles a lowered limit", () => {
    const now = new Date("2026-11-01T12:00:00Z");
    expect(recapAllowance([new Date("2026-10-20")], [new Date("2026-11-01T12:03Z")], 2, 30, now).remaining).toBe(0);
    expect(recapAllowance([new Date("2026-10-20"), new Date("2026-10-25")], [], 1, 30, now).nextAvailableAt).toBe("2026-11-24T00:00:00.000Z");
    expect(recapAllowance([], [], 0, 30, now).nextAvailableAt).toBeNull();
  });
  it("prioritizes durable ownership, Premium and a separately earned first report", () => {
    expect(recapMode(true, false, false)).toBe("OWNED");
    expect(recapMode(false, true, true)).toBe("PREMIUM");
    expect(recapMode(false, false, true)).toBe("EARNED");
    expect(recapMode(false, false, false)).toBe("COIN");
  });
});
