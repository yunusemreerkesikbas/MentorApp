"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, Info } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { MentorshipWeeklyReportShareDto } from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import { Skeleton, SkeletonGroup } from "@mentor/ui";
import { CompanionBubble } from "@/components/panel/companion-bubble";
import { PANEL_CARD, PANEL_TEXT_LINK } from "@/components/panel/panel-styles";
import { Link } from "@/i18n/navigation";
import { fetchMyWeeklyReport } from "@/lib/mentorship-weekly-report";
import { EvaluationHero, MocksCard, SubjectsCard, WeekCompareCard } from "./weekly-report-cards";

const TITLE = "text-display font-extrabold leading-tight tracking-[-0.01em] text-[var(--color-main)]";
const DAY_MS = 86_400_000;

/** A report's day, read at noon UTC so no time zone moves it to the day before. */
const atNoon = (day: string) => new Date(`${day}T12:00:00.000Z`);

/**
 * A week the coach finalized, as the student reads it (QA F5, redesigned in round 1, stop B3): the
 * coach's words first, then the week drawn against the one before, each drawing with its sentence.
 * A week with nothing logged gets Puhu's sentence instead of a row of zeroes. The coach's print
 * page and PDF keep their tables (`WeeklyReportPrintMetrics`); this page only reads the share
 * projection, never the coach's brief or evidence.
 */
export function MyWeeklyReportShell({ reportId }: { reportId: string }) {
  const t = useTranslations("mentorship");
  const common = useTranslations("common");
  const locale = useLocale();
  const [report, setReport] = useState<MentorshipWeeklyReportShareDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMyWeeklyReport(reportId)
      .then(setReport)
      .catch((reason: unknown) =>
        setError(reason instanceof ApiClientError ? reason.message : common("error_unknown")),
      );
  }, [common, reportId]);

  const period = report?.period;
  const days = period
    ? Math.round((atNoon(period.endDate).getTime() - atNoon(period.startDate).getTime()) / DAY_MS) + 1
    : 7;
  const limitations = report?.snapshot.limitations ?? [];

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-5 py-4 sm:px-8 lg:py-8">
      <Link href="/my-coach" className={`${PANEL_TEXT_LINK} self-start`}>
        <ChevronLeft aria-hidden className="size-4.5" strokeWidth={1.75} />
        {t("my_weekly_report_back")}
      </Link>
      {error ? (
        <p role="alert" className="text-body-sm font-semibold text-[var(--color-main)]">
          {error}
        </p>
      ) : !report || !period ? (
        <SkeletonGroup label={t("weekly_report_loading")} className="flex flex-col gap-5">
          <Skeleton className="h-16 w-72 rounded-[var(--radius-card)]" />
          <Skeleton className="h-40 w-full rounded-[var(--radius-card)]" />
          <Skeleton className="h-80 w-full rounded-[var(--radius-card)]" />
        </SkeletonGroup>
      ) : (
        <>
          <header className="-mt-2 flex flex-col gap-1">
            <h1 className={TITLE}>{t("my_weekly_report_title")}</h1>
            <p className="text-body-sm font-semibold text-[var(--color-secondary)]">
              {new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric" }).formatRange(
                atNoon(period.startDate),
                atNoon(period.endDate),
              )}
            </p>
          </header>

          <EvaluationHero report={report} />

          {report.snapshot.current.hasRecordedActivity ? (
            <>
              <WeekCompareCard snapshot={report.snapshot} days={days} />
              <SubjectsCard report={report} />
            </>
          ) : (
            <section className={PANEL_CARD}>
              <CompanionBubble puhu="encouraging" text={t("my_weekly_report_empty")} />
            </section>
          )}

          {report.snapshot.mocks.currentAttemptCount > 0 || report.snapshot.mocks.previousAttemptCount > 0 ? (
            <MocksCard mocks={report.snapshot.mocks} />
          ) : null}

          <footer className="flex flex-col gap-1.5">
            <p className="text-caption font-semibold text-[var(--color-secondary)]">{t("weekly_report_print_note")}</p>
            {limitations.length > 0 ? (
              <details>
                <summary className={`${PANEL_TEXT_LINK} cursor-pointer list-none`}>
                  <Info aria-hidden className="size-4" strokeWidth={1.75} />
                  {t("my_weekly_report_notes", { count: limitations.length })}
                </summary>
                <ul className="mt-1 flex list-disc flex-col gap-1 pl-5 text-caption font-semibold text-[var(--color-secondary)]">
                  {limitations.map((limitation) => (
                    <li key={limitation}>{t(`weekly_report_limitation_${limitation}`)}</li>
                  ))}
                </ul>
              </details>
            ) : null}
          </footer>
        </>
      )}
    </div>
  );
}
