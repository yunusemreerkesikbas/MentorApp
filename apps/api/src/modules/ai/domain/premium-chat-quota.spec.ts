import { describe, expect, it } from "vitest";
import { chatQuotaStatus } from "./premium-chat-quota";

const now = new Date("2026-11-04T12:00:00.000Z");

describe("chatQuotaStatus", () => {
  it("uses the later renewal when both rolling windows are full", () => {
    expect(chatQuotaStatus(
      ["2026-11-04T11:00:00Z", "2026-11-04T10:00:00Z", "2026-10-20T09:00:00Z"].map((value) => new Date(value)),
      { daily: 2, monthly: 3 },
      now,
    )).toEqual({
      dailyRemaining: 0,
      monthlyRemaining: 0,
      retryAt: "2026-11-19T09:00:00.000Z",
    });
  });

  it("waits for the right number of attempts to expire after a limit reduction", () => {
    expect(chatQuotaStatus(
      ["2026-11-04T11:00:00Z", "2026-11-04T10:00:00Z", "2026-11-03T12:00:00Z"].map((value) => new Date(value)),
      { daily: 1, monthly: 5 },
      now,
    )).toEqual({
      dailyRemaining: 0,
      monthlyRemaining: 2,
      retryAt: "2026-11-05T11:00:00.000Z",
    });
  });
});
