"use client";

import { useTranslations } from "next-intl";
import type { CoachingAnalysisDto } from "@mentor/types";
import { Button, Card, Chip } from "@mentor/ui";

interface AnalizSummaryBandProps {
  analysis: CoachingAnalysisDto | null;
  onNewEntry: () => void;
}

export function AnalizSummaryBand({
  analysis,
  onNewEntry,
}: AnalizSummaryBandProps) {
  const t = useTranslations("analysis.summary");

  const latest = analysis?.trend[0] ?? null;
  const ghost = analysis?.ghost ?? null;
  const focus = analysis?.nextFocus ?? null;

  if (!latest) {
    return (
      <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
          {t("empty")}
        </p>
        <Button type="button" onClick={onNewEntry} className="shrink-0">
          {t("new_entry")}
        </Button>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-col gap-2">
        <p
          className="text-lg font-bold tabular-nums"
          style={{
            color: "var(--color-main)",
            fontFamily: "var(--font-heading)",
          }}
        >
          {t("last_net", { net: latest.totalNet })}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {ghost ? (
            <Chip>{t("delta", { delta: ghost.previousDelta })}</Chip>
          ) : null}
          {focus ? (
            <span
              className="text-xs"
              style={{ color: "var(--color-secondary)" }}
            >
              {t("next_focus", { subject: focus.subjectName })}
            </span>
          ) : null}
        </div>
      </div>
      <Button
        type="button"
        onClick={onNewEntry}
        className="w-full shrink-0 sm:w-auto"
      >
        {t("new_entry")}
      </Button>
    </Card>
  );
}
