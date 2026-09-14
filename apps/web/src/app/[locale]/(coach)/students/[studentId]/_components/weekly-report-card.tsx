"use client";

import { useLocale, useTranslations } from "next-intl";
import { Button, Skeleton, SkeletonGroup, TextAreaField } from "@mentor/ui";
import { InsetSection, NOTE_CLASS } from "@/components/mentorship/coach-ui";
import { Link } from "@/i18n/navigation";
import { useWeeklyReportCard } from "./use-weekly-report-card";
import { WeeklyReportArchive } from "./weekly-report-archive";
import { WeeklyReportBrief } from "./weekly-report-brief";
import { WeeklyReportMetrics } from "./weekly-report-metrics";

export function WeeklyReportCard({ studentId }: { studentId: string }) {
  const t = useTranslations("mentorship");
  const locale = useLocale();
  const report = useWeeklyReportCard(studentId);

  if (report.state === "disabled") return null;
  if (report.state === "loading") {
    return (
      <SkeletonGroup
        label={t("weekly_report_loading")}
        className="flex flex-col gap-3"
      >
        <Skeleton className="h-8 w-56 rounded-[var(--radius-card)]" />
        <Skeleton className="h-64 w-full rounded-[var(--radius-card)]" />
      </SkeletonGroup>
    );
  }
  if (report.state === "failed" || !report.preview) {
    return (
      <InsetSection title={t("weekly_report_title")}>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-card)] bg-[var(--color-surface)] p-4">
          <p className={NOTE_CLASS}>{t("weekly_report_load_failed")}</p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => void report.retry()}
          >
            {t("weekly_report_retry")}
          </Button>
        </div>
      </InsetSection>
    );
  }

  const preview = report.preview;
  const dateFormat = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const formatDate = (value: string) =>
    dateFormat.format(new Date(`${value}T12:00:00.000Z`));
  const previousReport = report.archive.find(
    (item) => item.period.startDate === preview.snapshot.period.startDate,
  );

  return (
    <InsetSection title={t("weekly_report_title")}>
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <p className={NOTE_CLASS}>
          {t("weekly_report_period", {
            start: formatDate(preview.snapshot.period.startDate),
            end: formatDate(preview.snapshot.period.endDate),
          })}
        </p>
        <div className="flex flex-wrap items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={report.busy}
            onClick={() => void report.moveWeek(-1)}
          >
            {t("weekly_report_previous_week")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={
              report.busy ||
              preview.snapshot.period.startDate === report.latestWeek
            }
            onClick={() => void report.moveWeek(1)}
          >
            {t("weekly_report_next_week")}
          </Button>
        </div>
      </div>
      <WeeklyReportMetrics snapshot={preview.snapshot} />
      <WeeklyReportBrief
        preview={preview}
        busy={report.busy}
        onGenerate={() => void report.generateBrief()}
      />
      <div className="flex flex-col gap-3">
        <TextAreaField
          label={t("weekly_report_share_label")}
          value={report.evaluation}
          maxLength={1200}
          hint={t("weekly_report_share_hint", {
            count: report.evaluation.length,
          })}
          onChange={(event) => report.setEvaluation(event.target.value)}
        />
        {previousReport ? (
          <p className={NOTE_CLASS}>
            {t("weekly_report_correction", {
              version: previousReport.version + 1,
            })}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            busy={report.busy}
            onClick={() => void report.finalize()}
          >
            {t("weekly_report_finalize")}
          </Button>
          {report.finalized ? (
            <Link
              locale={report.finalized.locale}
              className="coach-footnote min-h-11 content-center font-semibold text-[var(--color-primary)]"
              href={{
                pathname:
                  "/students/[studentId]/weekly-reports/[reportId]/print",
                params: { studentId, reportId: report.finalized.id },
              }}
            >
              {t("weekly_report_open_finalized")}
            </Link>
          ) : null}
        </div>
      </div>
      <WeeklyReportArchive studentId={studentId} items={report.archive} />
    </InsetSection>
  );
}
