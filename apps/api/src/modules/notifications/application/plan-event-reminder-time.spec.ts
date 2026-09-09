import { describe, expect, it } from "vitest";
import {
  planEventReminderSchedule,
  planEventStartAt,
} from "./plan-event-reminder-time";

describe("plan event reminder time", () => {
  it("converts the Istanbul wall clock and subtracts fifteen minutes", () => {
    const startAt = planEventStartAt("2026-09-10", "10:30");
    const schedule = planEventReminderSchedule(
      { eventDate: "2026-09-10", startTime: "10:30" },
      new Date("2026-09-10T07:00:00.000Z"),
    );

    expect(startAt.toISOString()).toBe("2026-09-10T07:30:00.000Z");
    expect(schedule).toEqual({
      expectedStartAt: "2026-09-10T07:30:00.000Z",
      runAt: new Date("2026-09-10T07:15:00.000Z"),
    });
  });

  it("runs now after the reminder point and omits all-day or started events", () => {
    const now = new Date("2026-09-10T07:20:00.000Z");

    expect(
      planEventReminderSchedule(
        { eventDate: "2026-09-10", startTime: "10:30" },
        now,
      )?.runAt,
    ).toEqual(now);
    expect(
      planEventReminderSchedule(
        { eventDate: "2026-09-10", startTime: null },
        now,
      ),
    ).toBeNull();
    expect(
      planEventReminderSchedule(
        { eventDate: "2026-09-10", startTime: "10:20" },
        now,
      ),
    ).toBeNull();
  });
});
