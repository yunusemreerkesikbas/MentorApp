"use client";

import { useEffect, useState } from "react";
import { Download, Printer } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { MentorshipWeeklyReportShareDto } from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import { Button, Skeleton, SkeletonGroup } from "@mentor/ui";
import { Link } from "@/i18n/navigation";
import { trackMentorshipWeeklyReportEvent } from "@/lib/analytics";
import { fetchWeeklyReportShare } from "@/lib/mentorship-weekly-report";
import { WeeklyReportPrintMetrics } from "./weekly-report-print-metrics";

export function WeeklyReportPrintShell({
  studentId,
  reportId,
}: {
  studentId: string;
  reportId: string;
}) {
  const t = useTranslations("mentorship");
  const common = useTranslations("common");
  const locale = useLocale();
  const [report, setReport] = useState<MentorshipWeeklyReportShareDto | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    trackMentorshipWeeklyReportEvent("mentorship_weekly_report_print_open", {
      surface: "print_preview",
    });
    fetchWeeklyReportShare(studentId, reportId)
      .then(setReport)
      .catch((reason: unknown) =>
        setError(
          reason instanceof ApiClientError
            ? reason.message
            : common("error_unknown"),
        ),
      );
  }, [common, reportId, studentId]);

  if (error) {
    return (
      <div className="flex flex-col gap-4">
        <p role="alert" className="coach-body text-[var(--color-main)]">
          {error}
        </p>
        <Link
          href={{
            pathname: "/students/[studentId]",
            params: { studentId },
          }}
          className="coach-body font-semibold text-[var(--color-primary)]"
        >
          {t("weekly_report_back")}
        </Link>
      </div>
    );
  }
  if (!report) {
    return (
      <SkeletonGroup
        label={t("weekly_report_loading")}
        className="flex flex-col gap-3"
      >
        <Skeleton className="h-10 w-64 rounded-[var(--radius-card)]" />
        <Skeleton className="h-96 w-full rounded-[var(--radius-card)]" />
      </SkeletonGroup>
    );
  }

  const date = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const formatDate = (value: string) =>
    date.format(new Date(`${value}T12:00:00.000Z`));

  async function handleDownload(
    finalizedReport: MentorshipWeeklyReportShareDto,
  ) {
    setDownloading(true);
    setDownloadError(null);
    try {
      const { downloadWeeklyReportPdf } = await import("./weekly-report-pdf");
      await downloadWeeklyReportPdf(finalizedReport, locale, {
        title: t("weekly_report_print_title"),
        version: t("weekly_report_version", { version: finalizedReport.version }),
        period: t("weekly_report_period", { start: formatDate(finalizedReport.period.startDate), end: formatDate(finalizedReport.period.endDate) }),
        preparedBy: t("weekly_report_prepared_by", { coach: finalizedReport.coachDisplayName }),
        preparedAt: t("weekly_report_prepared_at", { date: formatDate(finalizedReport.finalizedAt.slice(0, 10)) }),
        current: t("weekly_report_current"),
        previous: t("weekly_report_previous"),
        focus: t("weekly_report_focus"),
        sessions: t("weekly_report_sessions"),
        activeDays: t("weekly_report_active_days"),
        plan: t("weekly_report_plan"),
        completion: t("weekly_report_completion"),
        subjects: t("weekly_report_subjects"),
        mocks: t("weekly_report_mocks"),
        mockAttempts: t("weekly_report_mock_attempts"),
        mockAverage: t("weekly_report_mock_average"),
        shareTitle: t("weekly_report_share_title"),
        note: t("weekly_report_print_note"),
        missing: t("weekly_report_missing"),
        unclassified: t("weekly_report_unclassified"),
      });
      trackMentorshipWeeklyReportEvent("mentorship_weekly_report_pdf_download", { surface: "print_preview" });
    } catch {
      setDownloadError(t("weekly_report_download_failed"));
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="weekly-report-print-root flex flex-col gap-4">
      <div className="weekly-report-print-toolbar sticky top-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-card)] bg-[var(--color-surface)] p-3 shadow-[var(--shadow-card)]">
        <div>
          <Link href={{ pathname: "/students/[studentId]", params: { studentId } }} className="coach-body min-h-11 content-center font-semibold text-[var(--color-primary)]">
            {t("weekly_report_back")}
          </Link>
          {downloadError ? <p role="alert" className="coach-footnote mt-1 text-[var(--color-error)]">{downloadError}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={() => window.print()}>
            <Printer aria-hidden size={18} />
            {t("weekly_report_print")}
          </Button>
          <Button type="button" busy={downloading} onClick={() => void handleDownload(report)}>
            <Download aria-hidden size={18} />
            {downloading ? t("weekly_report_downloading") : t("weekly_report_download")}
          </Button>
        </div>
      </div>
      <article className="weekly-report-print-sheet mx-auto w-full max-w-[210mm] rounded-[var(--radius-card)] bg-white p-6 text-[var(--color-body)] shadow-[var(--shadow-card)] sm:p-12">
        <header className="mb-8 border-b-2 border-[var(--color-primary)] pb-6">
          <p className="mb-2 text-sm font-semibold text-[var(--color-primary)]">
            {t("weekly_report_version", { version: report.version })}
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--color-main)]">
            {t("weekly_report_print_title")}
          </h1>
          <p className="mt-2 text-lg font-semibold text-[var(--color-main)]">
            {report.studentDisplayName}
          </p>
          <p className="mt-1 text-sm text-[var(--color-secondary)]">
            {t("weekly_report_period", {
              start: formatDate(report.period.startDate),
              end: formatDate(report.period.endDate),
            })}
          </p>
          <p className="mt-3 text-sm text-[var(--color-secondary)]">
            {t("weekly_report_prepared_by", { coach: report.coachDisplayName })}
          </p>
          <p className="text-sm text-[var(--color-secondary)]">
            {t("weekly_report_prepared_at", {
              date: formatDate(report.finalizedAt.slice(0, 10)),
            })}
          </p>
        </header>

        <WeeklyReportPrintMetrics report={report} />

        {report.coachEvaluation ? (
          <section className="mt-8 break-inside-avoid rounded-[var(--radius-card)] bg-[var(--color-surface-container)] p-5">
            <h2 className="mb-2 text-base font-bold">
              {t("weekly_report_share_title")}
            </h2>
            <p className="whitespace-pre-wrap text-sm leading-6">
              {report.coachEvaluation}
            </p>
          </section>
        ) : null}

        <footer className="mt-8 border-t border-[var(--color-border)] pt-4 text-xs leading-5 text-[var(--color-secondary)]">
          <p>{t("weekly_report_print_note")}</p>
        </footer>
      </article>
      <style jsx global>{`
        @page {
          size: A4;
          margin: 14mm;
        }
        @media print {
          body * {
            visibility: hidden;
          }
          .weekly-report-print-root,
          .weekly-report-print-root * {
            visibility: visible;
          }
          .weekly-report-print-root {
            position: absolute;
            inset: 0;
            display: block;
            background: white;
          }
          .weekly-report-print-toolbar {
            display: none !important;
          }
          .weekly-report-print-sheet {
            max-width: none;
            padding: 0;
            border-radius: 0;
            box-shadow: none;
          }
          .weekly-report-print-sheet section,
          .weekly-report-print-sheet tr {
            break-inside: avoid;
          }
        }
      `}</style>
    </div>
  );
}
