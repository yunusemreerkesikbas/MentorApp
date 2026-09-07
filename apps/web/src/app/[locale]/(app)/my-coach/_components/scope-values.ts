import type { MentorshipSharedDataDto } from "@mentor/types";

/**
 * One scope line's value: what is actually travelling under that heading, right now.
 *
 * Formatting only. Every number here was computed by the API (`standards/frontend.md`: the client
 * never recomputes), and this decides which sentence carries it and in what order — nothing more.
 *
 * Two keys deliberately return null rather than a value:
 *
 * - `AI_BRIEF` is a METHOD, not data. The scope line already says the coach may run an AI summary,
 *   and the student consented to that; "your coach last ran one on the 5th" is a different product
 *   decision about surveillance-feel, not a number this screen was asked to report.
 * - Anything the student has none of yet. An empty line is honest; a row of zeroes dressed as a
 *   report is not.
 */
export function scopeValue(
  key: string,
  values: MentorshipSharedDataDto,
  t: (key: string, args?: Record<string, string | number>) => string,
  locale: string,
): string | null {
  switch (key) {
    case "ACTIVITY": {
      const a = values.activity;
      if (!a) return null;
      return t("scope_value_ACTIVITY", {
        days: a.windowDays,
        sessions: a.sessions7d,
        minutes: a.focusMinutes7d,
        activeDays: a.activeDays7d,
        streak: a.currentStreak,
      });
    }
    case "MOCK_EXAMS": {
      const m = values.mockExams;
      if (!m) return null;
      // A pointer, not a restatement: the nets and the per-subject breakdown are on the student's
      // own analysis screen in more detail than the coach ever receives, and a worse second copy
      // here would weaken the one claim this screen makes.
      return t("scope_value_MOCK_EXAMS", { count: m.count, date: formatDay(m.latestAt, locale) });
    }
    case "PLAN_TASK_TITLES": {
      const p = values.planTasks;
      if (!p) return null;
      // Two windows, so two sentences rather than one number pretending to cover both: the titles
      // come from a 14-day span, the completion rate is a 7-day figure.
      const titles = t("scope_value_PLAN_TASK_TITLES", {
        count: p.titleCount,
        days: p.titleWindowDays,
      });
      if (p.planCompletionRate7d === null) return titles;
      return `${titles} ${t("scope_value_PLAN_RATE", {
        percent: Math.round(p.planCompletionRate7d * 100),
      })}`;
    }
    case "MOOD_LEVEL": {
      const m = values.mood;
      if (!m) return null;
      return t("scope_value_MOOD_LEVEL", {
        count: m.count,
        days: m.windowDays,
        average: m.average.toLocaleString(locale, { maximumFractionDigits: 1 }),
      });
    }
    case "EXAM_TRACK":
      return values.examType;
    default:
      return null;
  }
}

function formatDay(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "long" }).format(new Date(iso));
}
