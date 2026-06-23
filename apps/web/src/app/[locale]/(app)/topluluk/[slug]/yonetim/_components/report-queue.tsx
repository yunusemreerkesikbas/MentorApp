"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ModerationTargetType, ReportStatus, type ReportView } from "@mentor/types";
import { Button, Card, Chip, SectionHeading } from "@mentor/ui";
import {
  listZoneReports,
  resolveReport,
  restoreAnswer,
  restoreThread,
} from "@/lib/forum";

/** Owner/mod report queue: OPEN → hide/dismiss; RESOLVED → restore a hidden target. */
export function ReportQueue({ zoneId }: { zoneId: string }) {
  const t = useTranslations("topluluk");
  const [status, setStatus] = useState<string>(ReportStatus.OPEN);
  const [reports, setReports] = useState<ReportView[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    // No synchronous setState here (lint: setState-in-effect); list updates only in the callbacks.
    listZoneReports(zoneId, status)
      .then((res) => active && setReports(res.items))
      .catch(() => active && setReports([]));
    return () => {
      active = false;
    };
  }, [zoneId, status]);

  const act = async (report: ReportView, fn: () => Promise<void>) => {
    setBusyId(report.id);
    try {
      await fn();
      setReports((prev) => prev?.filter((r) => r.id !== report.id) ?? null);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="flex flex-col gap-4">
      <SectionHeading>{t("queue_title")}</SectionHeading>

      <div className="flex gap-2">
        {[ReportStatus.OPEN, ReportStatus.RESOLVED].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(s)}
            aria-pressed={status === s}
            className="rounded-[var(--radius-card)] border px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
            style={{
              borderColor: "color-mix(in srgb, var(--color-main) 12%, transparent)",
              backgroundColor:
                status === s ? "color-mix(in srgb, var(--color-chip) 30%, transparent)" : "transparent",
              color: "var(--color-main)",
            }}
          >
            {s === ReportStatus.OPEN ? t("queue_open") : t("queue_resolved")}
          </button>
        ))}
      </div>

      {reports === null ? (
        <p style={{ color: "var(--color-secondary)" }}>{t("loading")}</p>
      ) : reports.length === 0 ? (
        <p style={{ color: "var(--color-secondary)" }}>{t("no_reports")}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {reports.map((r) => (
            <Card key={r.id}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm" style={{ color: "var(--color-secondary)" }}>
                  <Chip>
                    {r.targetType === ModerationTargetType.THREAD ? t("target_thread") : t("target_post")}
                  </Chip>
                  <span>
                    {t("reason_label")}: {r.reason}
                  </span>
                </div>
                <div className="flex gap-2">
                  {status === ReportStatus.OPEN ? (
                    <>
                      <Button
                        busy={busyId === r.id}
                        onClick={() => void act(r, () => resolveReport(r.id, "HIDE"))}
                      >
                        {t("hide")}
                      </Button>
                      <Button
                        variant="secondary"
                        busy={busyId === r.id}
                        onClick={() => void act(r, () => resolveReport(r.id, "DISMISS"))}
                      >
                        {t("dismiss")}
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="secondary"
                      busy={busyId === r.id}
                      onClick={() =>
                        void act(r, () =>
                          r.targetType === ModerationTargetType.THREAD
                            ? restoreThread(r.targetId)
                            : restoreAnswer(r.targetId),
                        )
                      }
                    >
                      {t("restore")}
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
