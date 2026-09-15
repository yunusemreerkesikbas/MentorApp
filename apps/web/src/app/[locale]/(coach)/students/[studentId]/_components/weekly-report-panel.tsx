"use client";

import { useTranslations } from "next-intl";
import { Button, TextAreaField } from "@mentor/ui";
import { CoachOverlayBody, CoachOverlayFooter } from "@/components/coach-overlay";
import { NOTE_CLASS } from "@/components/mentorship/coach-ui";
import { Link } from "@/i18n/navigation";
import { CoachPanel } from "./coach-panel";
import { useWeeklyReportCard } from "./use-weekly-report-card";
import { WeeklyReportArchive } from "./weekly-report-archive";
import { WeeklyReportBrief } from "./weekly-report-brief";
import { WeeklyReportMetrics } from "./weekly-report-metrics";

type WeeklyReportState = ReturnType<typeof useWeeklyReportCard>;

export function WeeklyReportPanel({ studentId, report, period, formatDate, onClose }: {
  studentId: string;
  report: WeeklyReportState;
  period: string;
  formatDate: (value: string) => string;
  onClose: () => void;
}) {
  const t = useTranslations("mentorship");
  if (!report.preview) return null;
  const preview = report.preview;
  const previousReport = report.archive.find((item) => item.period.startDate === preview.snapshot.period.startDate);

  return (
    <CoachPanel title={t("weekly_report_title")} subtitle={period} busy={report.busy} wide onClose={onClose}>
      <CoachOverlayBody>
        <div className="flex flex-col gap-6 pb-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className={NOTE_CLASS}>{t("weekly_report_period", { start: formatDate(preview.snapshot.period.startDate), end: formatDate(preview.snapshot.period.endDate) })}</p>
            <div className="flex items-center gap-1">
              <Button type="button" variant="ghost" size="sm" disabled={report.busy} onClick={() => void report.moveWeek(-1)}>{t("weekly_report_previous_week")}</Button>
              <Button type="button" variant="ghost" size="sm" disabled={report.busy || preview.snapshot.period.startDate === report.latestWeek} onClick={() => void report.moveWeek(1)}>{t("weekly_report_next_week")}</Button>
            </div>
          </div>
          <WeeklyReportMetrics snapshot={preview.snapshot} />
          <WeeklyReportBrief preview={preview} busy={report.busy} onGenerate={() => void report.generateBrief()} />
          <section className="flex flex-col gap-3">
            <h3 className="coach-body font-semibold text-[var(--color-main)]">{t("weekly_report_share_title")}</h3>
            <TextAreaField label={t("weekly_report_share_label")} value={report.evaluation} maxLength={1200} hint={t("weekly_report_share_hint", { count: report.evaluation.length })} onChange={(event) => report.setEvaluation(event.target.value)} />
            {previousReport ? <p className={NOTE_CLASS}>{t("weekly_report_correction", { version: previousReport.version + 1 })}</p> : null}
          </section>
          <details className="rounded-[var(--radius-card)] bg-[var(--color-surface)] px-4 py-3">
            <summary className="coach-body cursor-pointer font-semibold text-[var(--color-main)]">{t("weekly_report_archive")} ({report.archive.length})</summary>
            <div className="pt-4"><WeeklyReportArchive studentId={studentId} items={report.archive} showTitle={false} /></div>
          </details>
        </div>
      </CoachOverlayBody>
      <CoachOverlayFooter>
        {report.finalized ? (
          <Link locale={report.finalized.locale} className="coach-footnote min-h-11 content-center px-2 font-semibold text-[var(--color-primary)]" href={{ pathname: "/students/[studentId]/weekly-reports/[reportId]/print", params: { studentId, reportId: report.finalized.id } }}>
            {t("weekly_report_open_finalized")}
          </Link>
        ) : null}
        <Button type="button" busy={report.busy} onClick={() => void report.finalize()}>{t("weekly_report_finalize")}</Button>
      </CoachOverlayFooter>
    </CoachPanel>
  );
}
