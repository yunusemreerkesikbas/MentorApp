import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildMentorshipWeeklyReportDemoSchedule } from "../scripts/mentorship-weekly-report-demo.schedule";

describe("mentorship weekly report development seed", () => {
  const source = readFileSync(
    resolve(__dirname, "../scripts/seed-mentorship-weekly-report.ts"),
    "utf8",
  );
  const packageJson = readFileSync(
    resolve(__dirname, "../package.json"),
    "utf8",
  );

  it("builds two completed weeks with comparison and missing-classification evidence", () => {
    const schedule = buildMentorshipWeeklyReportDemoSchedule(
      new Date("2026-09-14T09:00:00.000Z"),
    );

    expect(schedule.currentStartDate).toBe("2026-09-07");
    expect(schedule.previousStartDate).toBe("2026-08-31");
    expect(
      schedule.sessions.filter((row) => row.week === "current"),
    ).toHaveLength(5);
    expect(
      schedule.sessions.filter((row) => row.week === "previous"),
    ).toHaveLength(4);
    expect(schedule.sessions.some((row) => row.subjectIndex === null)).toBe(
      true,
    );
    expect(
      schedule.tasks.filter(
        (row) => row.week === "current" && row.status === "DONE",
      ),
    ).toHaveLength(4);
    expect(
      schedule.tasks.filter((row) => row.week === "current"),
    ).toHaveLength(6);
    expect(
      schedule.tasks.filter(
        (row) => row.week === "previous" && row.status === "DONE",
      ),
    ).toHaveLength(3);
    expect(
      schedule.tasks.filter((row) => row.week === "previous"),
    ).toHaveLength(5);
    expect(schedule.attempts.map((row) => row.week)).toEqual([
      "previous",
      "current",
    ]);
  });

  it("is development-only, active-link scoped and idempotent", () => {
    expect(source).toContain('NODE_ENV ?? ""');
    expect(source).toContain("cs.status = 'ACTIVE'");
    expect(source).toContain("cs.period_id");
    expect(source).toContain("on conflict (id) do update set");
    expect(source).toContain("Seed verification failed");
    expect(packageJson).toContain('"seed:mentorship-weekly-report"');
  });
});
