import type { useTranslations } from "next-intl";
import type { MentorshipStudentReportDto } from "@mentor/types";

type T = ReturnType<typeof useTranslations<"mentorship">>;

/** 150 → "2 sa 30 dk", 45 → "45 dk", 120 → "2 sa". */
export function durationLabel(t: T, total: number): string {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (hours === 0) return t("value_minutes", { count: minutes });
  return minutes === 0
    ? t("duration_hours", { hours })
    : t("duration_hours_minutes", { hours, minutes });
}

/**
 * Whether the student has left anything to read yet. A student with no trace gets the first-week
 * copy everywhere, and no paid brief about an empty report.
 */
export function hasTrace(report: MentorshipStudentReportDto): boolean {
  return (
    report.activity.lastActiveDate !== null ||
    report.planTasks.length > 0 ||
    report.mockTrend.length > 0 ||
    report.moodTrend.length > 0
  );
}
