"use client";

import { useLocale, useTranslations } from "next-intl";
import { Check, Sparkles } from "lucide-react";
import type { MentorshipRosterRowDto } from "@mentor/types";
import { Link } from "@/i18n/navigation";
import { ActivityStrip } from "../../_components/activity-strip";
import { daysSinceMark, isAttended } from "../../_components/attention";
import { sortFlags, worstFlag } from "../../_components/flag-order";
import { formatDate, relativeDay } from "../../_components/mentorship-format";
import { RiskChip } from "../../_components/risk-chip";
import { StudentAvatar } from "../../_components/student-avatar";

type T = ReturnType<typeof useTranslations<"mentorship">>;

const ROW = "flex items-center gap-3 border-t border-[var(--play-line)] first:border-t-0";

/** The row's one sentence: why they wait, when the coach looked, or how their week is going. */
function metaOf(row: MentorshipRosterRowDto, aiWhy: string | null, today: string, t: T): string {
  if (row.needsAttention) {
    const worst = worstFlag(row.riskFlags);
    return aiWhy ?? (worst ? t(`action_${worst}`) : "");
  }
  if (isAttended(row)) {
    const days = daysSinceMark(row.attendedAt!, today);
    return days <= 0
      ? t("row_seen_today")
      : days === 1
        ? t("row_seen_yesterday")
        : t("row_seen_days_ago", { count: days });
  }
  const last = relativeDay(row.metrics?.lastActiveDate ?? null);
  const studied =
    last.kind === "never"
      ? t("row_never_studied")
      : last.kind === "today"
        ? t("row_studied_today")
        : last.kind === "yesterday"
          ? t("row_studied_yesterday")
          : t("row_studied_days_ago", { count: last.days });
  const streak = row.metrics?.currentStreak ?? 0;
  return streak >= 2 ? `${studied} · ${t("row_streak", { count: streak })}` : studied;
}

/**
 * One student on the coach's list (DESIGN.md §6.1 row anatomy): who, the one sentence about them,
 * their last 14 days drawn, their flags, and the coach's mark. The mark sits outside the link: a
 * button inside an anchor is invalid HTML, and a tap on it must not open the report.
 */
export function StudentRow({
  row,
  aiWhy,
  today,
  busy,
  onMark,
}: {
  row: MentorshipRosterRowDto;
  /** The assistant's reason for a waiting student, when it wrote one. */
  aiWhy: string | null;
  today: string;
  busy: boolean;
  onMark: (studentId: string, attended: boolean) => void;
}) {
  const t = useTranslations("mentorship");
  const flags = sortFlags(row.riskFlags);
  const shown = flags.slice(0, 2);
  const rest = flags.slice(2);
  const attended = isAttended(row);
  const ai = row.needsAttention && aiWhy !== null;

  return (
    <li className={ROW} data-testid="student-row">
      <Link
        href={{ pathname: "/students/[studentId]", params: { studentId: row.studentId } }}
        className="flex min-h-[72px] min-w-0 flex-1 flex-wrap items-center gap-x-3.5 gap-y-2.5 rounded-[var(--radius-card)] py-3 outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
      >
        {/* The name keeps its room; when strip and pills cannot fit beside it they take the next
            line, which is how the row reads on a phone and in the two-column layout at 1280px. */}
        <span className="flex min-w-48 flex-1 items-center gap-3.5">
          <StudentAvatar name={row.studentDisplayName} src={row.avatarUrl} />
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-body-sm font-extrabold text-[var(--color-main)]">
              {row.studentDisplayName}
            </span>
            <span
              className={`flex min-w-0 items-start gap-1.5 text-caption font-semibold ${ai ? "text-[var(--color-body)]" : "text-[var(--color-secondary)]"}`}
            >
              {ai ? (
                <Sparkles
                  role="img"
                  aria-label={t("round_ai_label")}
                  className="mt-0.5 size-3.5 shrink-0 fill-current text-[var(--premium-ring-from)]"
                />
              ) : null}
              <span className="line-clamp-2">{metaOf(row, aiWhy, today, t)}</span>
            </span>
          </span>
        </span>
        {row.metrics ? (
          <span className="flex flex-wrap items-center gap-x-3.5 gap-y-2">
            <ActivityStrip minutes={row.metrics.dailyFocusMinutes14d} today={today} />
            <span className="flex gap-1.5 sm:min-w-32 sm:justify-end">
              {shown.map((flag) => (
                <RiskChip key={flag} flag={flag} />
              ))}
              {rest.length > 0 ? (
                <span
                  title={rest.map((flag) => t(`flag_${flag}`)).join(", ")}
                  className="inline-flex h-6 items-center rounded-full border border-[var(--play-line)] bg-[var(--color-surface)] px-2 text-xs font-semibold text-[var(--color-body)]"
                >
                  +{rest.length}
                  <span className="sr-only">: {rest.map((flag) => t(`flag_${flag}`)).join(", ")}</span>
                </span>
              ) : null}
            </span>
          </span>
        ) : null}
      </Link>
      {flags.length > 0 || attended ? (
        <button
          type="button"
          // One name in both states; `aria-pressed` says whether the mark is on, and the row's
          // meta line says when the coach looked.
          aria-pressed={attended}
          aria-label={t("row_attention_aria", { name: row.studentDisplayName })}
          disabled={busy}
          onClick={() => onMark(row.studentId, !attended)}
          className={`grid size-11 shrink-0 cursor-pointer place-items-center rounded-full border-2 outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] disabled:cursor-wait motion-reduce:transition-none ${
            attended
              ? "border-[var(--coach-accent)] bg-[var(--coach-accent)] text-[var(--color-bg)]"
              : "border-[var(--play-line)] bg-[var(--color-surface)] text-[var(--color-secondary)] hover:border-[var(--coach-accent)] hover:text-[var(--coach-accent)]"
          }`}
          data-testid="attention-toggle"
        >
          <Check className="size-5" strokeWidth={3} aria-hidden />
        </button>
      ) : (
        <span aria-hidden className="w-11 shrink-0" />
      )}
    </li>
  );
}

/** A student whose link ended: who they were and when it closed. Nothing opens, nothing is drawn. */
export function EndedStudentRow({ row }: { row: MentorshipRosterRowDto }) {
  const t = useTranslations("mentorship");
  const locale = useLocale();
  return (
    <li className={`${ROW} min-h-[72px] py-3`} data-testid="student-row-ended">
      <StudentAvatar name={row.studentDisplayName} src={row.avatarUrl} />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-body-sm font-extrabold text-[var(--color-main)]">
          {row.studentDisplayName}
        </span>
        <span className="text-caption font-semibold text-[var(--color-secondary)]">
          {row.endedAt ? t("ended_on", { date: formatDate(row.endedAt, locale) }) : t("ended_no_access")}
        </span>
      </span>
    </li>
  );
}
