"use client";

import { MENTORSHIP_COACH_CONTEXT_MAX_LENGTH } from "@mentor/validation";
import { WeeklyPreparation } from "./weekly-preparation";
import { useLocale, useTranslations } from "next-intl";
import type { MentorshipWeeklyReportPreviewDto } from "@mentor/types";
import { Button, TextAreaField } from "@mentor/ui";
import {
  INSET_GROUP_CLASS,
  NOTE_CLASS,
} from "@/components/mentorship/coach-ui";
import { formatWeeklyMetric } from "@/lib/mentorship-weekly-report";

export function WeeklyReportBrief({
  preview,
  coachContext,
  onContextChange,
  busy,
  onGenerate,
}: {
  preview: MentorshipWeeklyReportPreviewDto;
  coachContext: string;
  onContextChange: (value: string) => void;
  busy: boolean;
  onGenerate: () => void;
}) {
  const t = useTranslations("mentorship");
  const locale = useLocale();
  const evidence = new Map(
    preview.snapshot.evidence.map((item) => [item.id, item]),
  );

  return (
    <section className="flex flex-col gap-3" aria-labelledby="weekly-ai-title">
      <div className="flex flex-wrap items-start justify-between gap-3 px-1">
        <div>
          <h3
            id="weekly-ai-title"
            className="coach-headline text-[var(--color-main)]"
          >
            {t("weekly_report_ai_title")}
          </h3>
          <p className={NOTE_CLASS}>{t("weekly_report_ai_body")}</p>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          busy={busy || preview.status === "BRIEF_PENDING"}
          disabled={preview.status === "BRIEF_PENDING"}
          onClick={onGenerate}
        >
          {preview.brief
            ? t("weekly_report_ai_refresh")
            : t("weekly_report_ai_generate")}
        </Button>
      </div>

      <TextAreaField
        label={t("preparation_context_label")}
        value={coachContext}
        onChange={(event) => onContextChange(event.target.value)}
        maxLength={MENTORSHIP_COACH_CONTEXT_MAX_LENGTH}
        disabled={busy || preview.status === "BRIEF_PENDING"}
        hint={t("preparation_context_hint", { count: coachContext.length })}
        placeholder={t("preparation_context_placeholder")}
        rows={3}
      />
      {preview.brief &&
        coachContext.trim() !== (preview.brief.coachContext ?? "") && (
          <p className={NOTE_CLASS} role="status">
            {t("preparation_context_changed")}
          </p>
        )}
      {preview.brief?.coachContext && (
        <p className={`${NOTE_CLASS} whitespace-pre-wrap break-words`}>
          {t("preparation_used_context", {
            context: preview.brief.coachContext,
          })}
        </p>
      )}
      {preview.status === "BRIEF_PENDING" ? (
        <p className={NOTE_CLASS} role="status">
          {t("weekly_report_ai_pending")}
        </p>
      ) : preview.status === "BRIEF_FAILED" ? (
        <p className={NOTE_CLASS} role="status">
          {t("weekly_report_ai_failed")}
        </p>
      ) : preview.brief?.preparation ? (
        <WeeklyPreparation
          preparation={preview.brief.preparation}
          evidence={preview.snapshot.evidence}
        />
      ) : preview.brief ? (
        <ol className="flex flex-col gap-3">
          {preview.brief.findings.map((finding, index) => (
            <li
              key={`${finding.observation}-${index}`}
              className={`${INSET_GROUP_CLASS} flex flex-col gap-3 p-4`}
            >
              <div>
                <p className="coach-footnote font-semibold text-[var(--color-secondary)]">
                  {t("weekly_report_observation")}
                </p>
                <p className="coach-body text-[var(--color-main)]">
                  {finding.observation}
                </p>
              </div>
              <div>
                <p className="coach-footnote font-semibold text-[var(--color-secondary)]">
                  {t("weekly_report_evidence")}
                </p>
                <ul className="mt-1 flex flex-wrap gap-2">
                  {finding.evidenceIds.map((id) => {
                    const item = evidence.get(id);
                    if (!item) return null;
                    return (
                      <li
                        key={id}
                        className="rounded-full bg-[var(--color-primary-soft)] px-3 py-1 coach-footnote text-[var(--color-primary)]"
                      >
                        {t(`weekly_report_evidence_${id}`)}:{" "}
                        {formatWeeklyMetric(item.kind, item.previous, locale)} →{" "}
                        {formatWeeklyMetric(item.kind, item.current, locale)}
                      </li>
                    );
                  })}
                </ul>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <p className="coach-footnote font-semibold text-[var(--color-secondary)]">
                    {t("weekly_report_uncertainty")}
                  </p>
                  <p className="coach-body text-[var(--color-main)]">
                    {finding.uncertainty}
                  </p>
                </div>
                <div>
                  <p className="coach-footnote font-semibold text-[var(--color-secondary)]">
                    {t("weekly_report_question")}
                  </p>
                  <p className="coach-body text-[var(--color-main)]">
                    {finding.conversationQuestion}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}
