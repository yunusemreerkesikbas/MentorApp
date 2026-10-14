"use client";

import { useEffect, useState } from "react";
import { Flag } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { ModerationTargetType, ReportStatus, type ReportView } from "@mentor/types";
import { Button, Skeleton, SkeletonGroup } from "@mentor/ui";
import { PANEL_CARD, PANEL_CARD_TITLE, PANEL_QUIET_LINK } from "@/components/panel/panel-styles";
import { SegmentPillControl } from "@/components/segment-pill-control";
import { listZoneReports, resolveReport, restoreAnswer, restoreThread } from "@/lib/forum";
import { useMentorDialog } from "@/lib/mentor-dialog";
import { useMentorToast } from "@/lib/mentor-toast";
import { relativeTime } from "@/lib/relative-time";

const REASON_LABEL = {
  SPAM: "report_spam",
  HARASSMENT: "report_harassment",
  OFF_TOPIC: "report_off_topic",
  OTHER: "report_other",
} as const;

/**
 * Owner/mod report queue: what was reported (the start of it, in place), why, and when. Open → hide
 * (asks first) or let it be; resolved → bring a hidden one back. Calm register: moderation, no cheers.
 */
export function ReportsCard({ zoneId }: { zoneId: string }) {
  const t = useTranslations("community");
  const locale = useLocale();
  const dialog = useMentorDialog();
  const toast = useMentorToast();
  const [status, setStatus] = useState<string>(ReportStatus.OPEN);
  const [reports, setReports] = useState<ReportView[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    listZoneReports(zoneId, status)
      .then((res) => active && setReports(res.items))
      .catch(() => active && setReports([]));
    return () => {
      active = false;
    };
  }, [zoneId, status]);

  const act = async (report: ReportView, action: () => Promise<void>) => {
    setBusyId(report.id);
    try {
      await action();
      setReports((current) => current?.filter((r) => r.id !== report.id) ?? null);
    } catch {
      toast.error({ title: t("action_failed") });
    } finally {
      setBusyId(null);
    }
  };

  const hide = async (report: ReportView) => {
    const ok = await dialog.confirm({
      title: t("hide_confirm_title"),
      message: t("hide_confirm"),
      confirmLabel: t("hide"),
      cancelLabel: t("cancel"),
      destructive: true,
    });
    if (ok) await act(report, () => resolveReport(report.id, "HIDE"));
  };

  const restore = (report: ReportView) =>
    act(report, () =>
      report.targetType === ModerationTargetType.THREAD ? restoreThread(report.targetId) : restoreAnswer(report.targetId),
    );

  return (
    <section className={`${PANEL_CARD} flex flex-col gap-3`} aria-labelledby="manage-reports-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="manage-reports-title" className={PANEL_CARD_TITLE}>
          {t("queue_title")}
        </h2>
        <SegmentPillControl
          items={[
            { id: ReportStatus.OPEN, label: t("queue_open") },
            { id: ReportStatus.RESOLVED, label: t("queue_resolved") },
          ]}
          value={status}
          onChange={(value) => {
            setReports(null);
            setStatus(value);
          }}
          ariaLabel={t("reports_tab_label")}
          idPrefix="manage-reports"
        />
      </div>

      {reports === null ? (
        <SkeletonGroup label={t("loading")} className="flex flex-col gap-3">
          <Skeleton className="h-4 w-48 max-w-full rounded-full" />
          <Skeleton className="h-14 w-full rounded-[var(--radius-card)]" />
        </SkeletonGroup>
      ) : reports.length === 0 ? (
        <p className="py-4 text-body-sm font-semibold text-[var(--color-secondary)]">{t("no_reports")}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-[var(--color-border)]">
          {reports.map((r) => (
            <li key={r.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:gap-3">
              <span className="hidden size-10 shrink-0 place-items-center text-[var(--color-secondary)] sm:grid" aria-hidden>
                <Flag size={20} strokeWidth={1.75} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                <span className="text-body-sm font-extrabold text-[var(--color-main)]">
                  {r.targetType === ModerationTargetType.THREAD ? t("target_thread") : t("target_post")}
                  {" · "}
                  {t(REASON_LABEL[r.reason])}
                </span>
                {r.excerpt ? (
                  <q className="rounded-[var(--radius-card)] bg-[var(--color-surface-container)] px-3 py-2 text-body-sm font-semibold text-[var(--color-body)]">
                    {r.excerpt}
                  </q>
                ) : null}
                <span className="text-caption font-semibold text-[var(--color-secondary)]">
                  {[relativeTime(r.createdAt, locale), r.note ? t("report_note", { note: r.note }) : null]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-4 self-end sm:self-center">
                {status === ReportStatus.OPEN ? (
                  <>
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={() => void act(r, () => resolveReport(r.id, "DISMISS"))}
                      className={PANEL_QUIET_LINK}
                    >
                      {t("dismiss")}
                    </button>
                    <Button size="sm" variant="secondary" busy={busyId === r.id} onClick={() => void hide(r)}>
                      <span className="text-[var(--color-danger)]">{t("hide")}</span>
                    </Button>
                  </>
                ) : (
                  <Button size="sm" variant="secondary" busy={busyId === r.id} onClick={() => void restore(r)}>
                    {t("restore")}
                  </Button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
