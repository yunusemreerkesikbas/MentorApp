import { describe, expect, it } from "vitest";
import { copyKey, copyTask, monday, shiftDate } from "./planning-state";
import { todayInIstanbul } from "@/lib/date-time";

describe("weekly planning dates", () => {
  it("uses Monday through Sunday across the year boundary", () => {
    expect(monday("2027-01-03")).toBe("2026-12-28");
    expect(monday("2027-01-04")).toBe("2027-01-04");
    expect(shiftDate("2026-12-28", 6)).toBe("2027-01-03");
  });
  it("uses Istanbul midnight independently of the browser timezone", () => {
    expect(todayInIstanbul(new Date("2026-09-20T21:01:00Z"))).toBe(
      "2026-09-21",
    );
  });
  it("copies the weekday without mutating the source or leaking identifiers/status", () => {
    const source = {
      id: "task",
      taskDate: "2026-09-16",
      title: "Practice",
      subject: null,
      topic: null,
      coachNote: "Review",
      status: "DONE",
      assignedByCoach: true,
    };
    const result = copyTask(source, "2026-09-14", "2026-09-21");
    expect(result.taskDate).toBe("2026-09-23");
    expect(result).not.toHaveProperty("status");
    expect(result).not.toHaveProperty("id");
    expect(source.taskDate).toBe("2026-09-16");
    expect(copyKey(source.id, "2026-09-21")).not.toBe(
      copyKey(source.id, "2026-09-28"),
    );
  });
});
