"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { MentorshipStudentReportDto } from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import { Button, Card, SectionHeading, Skeleton, SkeletonGroup } from "@mentor/ui";
import { EmptyState } from "@/components/empty-state";
import { Link, useRouter } from "@/i18n/navigation";
import { useMentorDialog } from "@/lib/mentor-dialog";
import { useMentorToast } from "@/lib/mentor-toast";
import { endStudentLink, fetchStudentReport } from "@/lib/mentorship";
import { AssignTaskForm } from "./assign-task-form";
import {
  formatDate,
  formatMood,
  formatNet,
  formatRate,
  relativeDay,
} from "../../../_components/mentorship-format";
import { NoRiskChip, RiskChip } from "../../../_components/risk-chip";

export function StudentReportShell({ studentId }: { studentId: string }) {
  const t = useTranslations("mentorship");
  const common = useTranslations("common");
  const locale = useLocale();
  const toast = useMentorToast();
  const dialog = useMentorDialog();
  const router = useRouter();
  const [report, setReport] = useState<MentorshipStudentReportDto | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  const showError = useCallback(
    (err: unknown) => {
      toast.error({
        title: common("error_title"),
        message: err instanceof ApiClientError ? err.message : common("error_unknown"),
      });
    },
    [toast, common],
  );

  const load = useCallback(() => {
    fetchStudentReport(studentId)
      .then(setReport)
      .catch((err: unknown) => {
        setFailed(true);
        showError(err);
      });
  }, [studentId, showError]);

  useEffect(load, [load]);

  async function endLink() {
    if (!report) return;
    const confirmed = await dialog.confirm({
      title: t("report_end_confirm_title"),
      message: t("report_end_confirm_body", { name: report.studentDisplayName }),
      confirmLabel: t("report_end_confirm_action"),
      cancelLabel: t("confirm_cancel"),
    });
    if (!confirmed) return;
    setBusy(true);
    try {
      await endStudentLink(studentId);
      router.replace("/students");
    } catch (err) {
      showError(err);
      setBusy(false);
    }
  }

  if (failed) {
    return (
      <EmptyState
        title={t("guard_title")}
        description={t("guard_body")}
        puhuVariant="encouraging"
        action={
          <Link href="/students">
            <Button variant="secondary">{t("report_back")}</Button>
          </Link>
        }
      />
    );
  }

  if (!report) {
    return (
      <SkeletonGroup label={t("loading")}>
        <Skeleton className="h-10 w-56 rounded-[var(--radius-card)]" />
        <Skeleton className="h-32 w-full rounded-[var(--radius-card)]" />
        <Skeleton className="h-48 w-full rounded-[var(--radius-card)]" />
      </SkeletonGroup>
    );
  }

  const last = relativeDay(report.activity.lastActiveDate);
  const lastLabel =
    last.kind === "never"
      ? t("value_never")
      : last.kind === "today"
        ? t("value_today")
        : last.kind === "yesterday"
          ? t("value_yesterday")
          : t("value_days_ago", { count: last.days });

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/students"
        className="text-sm underline-offset-4 hover:underline"
        style={{ color: "var(--color-secondary)" }}
      >
        {t("report_back")}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <SectionHeading
          subtitle={
            report.acceptedAt
              ? t("my_coach_since", { date: formatDate(report.acceptedAt, locale) })
              : undefined
          }
        >
          {report.studentDisplayName}
        </SectionHeading>
        <div className="flex flex-wrap items-center gap-1.5">
          {report.riskFlags.length === 0 ? (
            <NoRiskChip />
          ) : (
            report.riskFlags.map((flag) => <RiskChip key={flag} flag={flag} />)
          )}
        </div>
      </div>

      <AssignTaskForm
        studentId={studentId}
        studentName={report.studentDisplayName}
        onAssigned={load}
      />

      <Card>
        <h2 className="mb-3 text-sm font-semibold" style={{ color: "var(--color-main)" }}>
          {t("report_activity")}
        </h2>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">
          <Metric label={t("metric_last_active")} value={lastLabel} />
          <Metric label={t("metric_streak")} value={String(report.activity.currentStreak)} />
          <Metric
            label={t("metric_longest_streak")}
            value={String(report.activity.longestStreak)}
          />
          <Metric
            label={t("metric_plan_completion")}
            value={formatRate(report.planCompletionRate7d, locale) ?? t("value_none")}
          />
          <Metric
            label={t("metric_focus_7d")}
            value={t("value_minutes", { count: report.activity.focusMinutes7d })}
          />
          <Metric
            label={t("metric_sessions_7d")}
            value={String(report.activity.sessions7d)}
          />
          <Metric
            label={t("metric_active_days_7d")}
            value={String(report.activity.activeDays7d)}
          />
          <Metric
            label={t("metric_focus_28d")}
            value={t("value_minutes", { count: report.activity.focusMinutes28d })}
          />
        </dl>
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold" style={{ color: "var(--color-main)" }}>
          {t("report_mocks")}
        </h2>
        {report.mockTrend.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
            {t("report_mock_empty")}
          </p>
        ) : (
          <>
            <ul className="flex flex-col gap-2">
              {report.mockTrend.map((mock) => (
                <li
                  key={mock.takenAt}
                  className="flex items-baseline justify-between gap-3 text-sm"
                >
                  <span style={{ color: "var(--color-secondary)" }}>
                    {formatDate(mock.takenAt, locale)}
                    {mock.publisherName ? ` · ${mock.publisherName}` : ""}
                  </span>
                  <span className="font-medium" style={{ color: "var(--color-main)" }}>
                    {formatNet(mock.totalNet, locale)}
                  </span>
                </li>
              ))}
            </ul>
            {report.latestMockSubjects.length > 0 ? (
              <div className="mt-4">
                <h3
                  className="mb-2 text-xs font-semibold"
                  style={{ color: "var(--color-secondary)" }}
                >
                  {t("report_latest_mock_subjects")}
                </h3>
                {/* Wide content scrolls inside its own box; the page never scrolls sideways. */}
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[24rem] text-sm">
                    <thead>
                      <tr style={{ color: "var(--color-secondary)" }}>
                        <th className="py-1 text-left font-medium">
                          {t("report_subject_table_subject")}
                        </th>
                        <th className="py-1 text-right font-medium">
                          {t("report_subject_table_correct")}
                        </th>
                        <th className="py-1 text-right font-medium">
                          {t("report_subject_table_wrong")}
                        </th>
                        <th className="py-1 text-right font-medium">
                          {t("report_subject_table_blank")}
                        </th>
                        <th className="py-1 text-right font-medium">
                          {t("report_subject_table_net")}
                        </th>
                      </tr>
                    </thead>
                    <tbody style={{ color: "var(--color-main)" }}>
                      {report.latestMockSubjects.map((subject) => (
                        <tr key={subject.subjectRef}>
                          <td className="py-1">{subject.subjectRef}</td>
                          <td className="py-1 text-right">{subject.correct}</td>
                          <td className="py-1 text-right">{subject.wrong}</td>
                          <td className="py-1 text-right">{subject.blank}</td>
                          <td className="py-1 text-right font-medium">
                            {formatNet(subject.net, locale)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </>
        )}
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold" style={{ color: "var(--color-main)" }}>
          {t("report_plan")}
        </h2>
        {report.planTasks.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
            {t("report_plan_empty")}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {report.planTasks.map((task, index) => (
              <li
                key={`${task.taskDate}-${index}`}
                className="flex flex-wrap items-baseline justify-between gap-2 text-sm"
              >
                <span style={{ color: "var(--color-main)" }}>
                  {task.title}
                  {task.subject ? (
                    <span style={{ color: "var(--color-secondary)" }}> · {task.subject}</span>
                  ) : null}
                </span>
                <span className="text-xs" style={{ color: "var(--color-secondary)" }}>
                  {formatDate(`${task.taskDate}T00:00:00.000Z`, locale)} ·{" "}
                  {t(`task_status_${task.status === "DONE" ? "DONE" : "PENDING"}`)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold" style={{ color: "var(--color-main)" }}>
          {t("report_mood")}
        </h2>
        {report.moodTrend.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
            {t("report_mood_empty")}
          </p>
        ) : (
          <ul className="flex flex-wrap gap-3 text-sm">
            {report.moodTrend.map((entry) => (
              <li key={entry.date} style={{ color: "var(--color-main)" }}>
                <span style={{ color: "var(--color-secondary)" }}>
                  {formatDate(`${entry.date}T00:00:00.000Z`, locale)}
                </span>{" "}
                {formatMood(entry.level, locale)}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div>
        <Button variant="ghost" busy={busy} onClick={endLink}>
          {t("report_end_link")}
        </Button>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs" style={{ color: "var(--color-secondary)" }}>
        {label}
      </dt>
      <dd className="text-sm font-medium" style={{ color: "var(--color-main)" }}>
        {value}
      </dd>
    </div>
  );
}
