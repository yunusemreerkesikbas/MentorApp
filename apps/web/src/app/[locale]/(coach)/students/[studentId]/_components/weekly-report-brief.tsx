"use client";

import { useId, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { MENTORSHIP_COACH_CONTEXT_MAX_LENGTH } from "@mentor/validation";
import { COACH_FAST } from "@/components/mentorship/coach-motion";
import { WeeklyPreparation } from "./weekly-preparation";
import { useLocale, useTranslations } from "next-intl";
import type { MentorshipWeeklyReportPreviewDto } from "@mentor/types";
import { Button, ShimmerText, TextAreaField } from "@mentor/ui";
import {
  INSET_GROUP_CLASS,
  NOTE_CLASS,
  PANEL_QUIET_BUTTON,
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
  const contextId = useId();
  // Opens by itself when there is already a focus to read; otherwise it waits to be asked for.
  const [showContext, setShowContext] = useState(
    () => coachContext.trim() !== "" || Boolean(preview.brief?.coachContext),
  );
  const evidence = new Map(
    preview.snapshot.evidence.map((item) => [item.id, item]),
  );

  return (
    <section className="flex flex-col gap-3" aria-labelledby="weekly-ai-title">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-[var(--radius-card)] bg-[var(--color-surface-container)] px-4 py-3">
        {/* A floor on the words: on a phone the button wraps below instead of squeezing the title. */}
        <div className="flex min-w-48 flex-1 flex-col gap-0.5">
          <h3
            id="weekly-ai-title"
            className="text-body-sm font-extrabold text-[var(--color-main)]"
          >
            {t("weekly_report_ai_title")}
          </h3>
          <p className="text-caption font-semibold text-[var(--color-secondary)]">{t("weekly_report_ai_body")}</p>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="shrink-0"
          busy={busy || preview.status === "BRIEF_PENDING"}
          disabled={preview.status === "BRIEF_PENDING"}
          onClick={onGenerate}
        >
          <Sparkles className="size-4" aria-hidden />
          {preview.brief
            ? t("weekly_report_ai_refresh")
            : t("weekly_report_ai_generate")}
        </Button>
      </div>

      {/* The field opens by height; the gap above it collapses with it, and a 4 px margin keeps
          focus rings clear of the clipping edge. */}
      <div className="flex flex-col">
        <button
          type="button"
          className={`${PANEL_QUIET_BUTTON} self-start`}
          aria-expanded={showContext}
          aria-controls={showContext ? contextId : undefined}
          onClick={() => setShowContext((value) => !value)}
        >
          {t("weekly_panel_add_context")}
        </button>
        <AnimatePresence initial={false}>
          {showContext ? (
            <motion.div
              key="context"
              id={contextId}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={COACH_FAST}
              className="-mx-1 -mb-1 overflow-hidden px-1 pb-1"
            >
              <div className="pt-3">
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
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
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
          <ShimmerText text={t("weekly_report_ai_pending")} />
        </p>
      ) : preview.status === "BRIEF_FAILED" ? (
        <p className={NOTE_CLASS} role="status">
          {t("weekly_report_ai_failed")}
        </p>
      ) : preview.brief?.preparation ? (
        <WeeklyPreparation
          preparation={preview.brief.preparation}
          evidence={preview.snapshot.evidence}
          subjectNames={preview.subjectNames}
        />
      ) : preview.brief ? (
        <ol className="flex flex-col gap-3">
          {preview.brief.findings.map((finding, index) => (
            <li
              key={`${finding.observation}-${index}`}
              className={`${INSET_GROUP_CLASS} flex flex-col gap-3 p-4`}
            >
              <div>
                <p className="text-caption font-extrabold text-[var(--color-secondary)]">
                  {t("weekly_report_observation")}
                </p>
                <p className="text-body-sm text-[var(--color-main)]">
                  {finding.observation}
                </p>
              </div>
              <div>
                <p className="text-caption font-extrabold text-[var(--color-secondary)]">
                  {t("weekly_report_evidence")}
                </p>
                <ul className="mt-1 flex flex-wrap gap-2">
                  {finding.evidenceIds.map((id) => {
                    const item = evidence.get(id);
                    if (!item) return null;
                    return (
                      <li
                        key={id}
                        className="rounded-full bg-[var(--play-selected)] px-3 py-1 text-caption font-bold text-[var(--play-selected-ink)]"
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
                  <p className="text-caption font-extrabold text-[var(--color-secondary)]">
                    {t("weekly_report_uncertainty")}
                  </p>
                  <p className="text-body-sm text-[var(--color-main)]">
                    {finding.uncertainty}
                  </p>
                </div>
                <div>
                  <p className="text-caption font-extrabold text-[var(--color-secondary)]">
                    {t("weekly_report_question")}
                  </p>
                  <p className="text-body-sm text-[var(--color-main)]">
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
