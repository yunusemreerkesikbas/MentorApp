import { describe, expect, it } from "vitest";
import { todayInIstanbul } from "./date-time";

describe("todayInIstanbul", () => {
  it("uses Istanbul's date across the UTC midnight boundary", () => {
    expect(todayInIstanbul(new Date("2026-09-09T21:30:00.000Z"))).toBe("2026-09-10");
    expect(todayInIstanbul(new Date("2026-09-09T20:59:59.999Z"))).toBe("2026-09-09");
  });
});
