"use client";

import { Copy } from "lucide-react";
import { useState } from "react";
import { useTranslations } from "next-intl";
import type { ExamSubjectDto, ExamSummaryDto } from "@mentor/types";
import { EmptyState } from "@/components/empty-state";
import { FormError } from "@/components/form";
import { PANEL_HERO, PANEL_HERO_TITLE, PANEL_TEXT_LINK } from "@/components/panel/panel-styles";
import { fetchMockExamsList } from "@/lib/mock-exams";
import { AnalysisMockExamForm } from "./analysis-mock-exam-form";
import { paperSubjects } from "./analysis-types";
import { errorMessage } from "./use-analysis-data";
import type { MockExamEntry } from "./use-mock-exam-entry";

/**
 * "Deneme sonucu gir" in the panel's card: what the paper holds, a shortcut that copies the last
 * exam, and the form. The saved moment takes this card's place after a save.
 */
export function AnalysisEntryCard({
  exam,
  subjects,
  entry,
  onCopied,
}: {
  exam: ExamSummaryDto | null;
  subjects: ExamSubjectDto[];
  entry: MockExamEntry;
  /** After a copy: bring the filled form into view. */
  onCopied: () => void;
}) {
  const t = useTranslations("analysis");
  const [copying, setCopying] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const scored = paperSubjects(subjects);
  const ready = exam != null && scored.length > 0;

  async function copyLast() {
    if (!exam || copying) return;
    setCopying(true);
    setCopyError(null);
    try {
      const latest = (await fetchMockExamsList(1, 1, exam.id)).items[0];
      if (!latest) {
        setCopyError(t("copy_last_empty"));
        return;
      }
      entry.copyFrom(latest);
      onCopied();
    } catch (error) {
      setCopyError(errorMessage(error));
    } finally {
      setCopying(false);
    }
  }

  return (
    <section id="analysis-form" className={PANEL_HERO} aria-labelledby="analysis-entry-title">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 id="analysis-entry-title" className={PANEL_HERO_TITLE}>
            {t("result_entry_title")}
          </h2>
          {ready ? (
            <p className="text-caption font-semibold text-[var(--color-secondary)]">
              {t("entry.caption", {
                exam: exam.name,
                subjects: scored.length,
                questions: scored.reduce((sum, subject) => sum + (subject.questionCount ?? 0), 0),
              })}
            </p>
          ) : null}
        </div>
        {ready ? (
          <button
            type="button"
            onClick={() => void copyLast()}
            disabled={copying}
            className={`${PANEL_TEXT_LINK} shrink-0 cursor-pointer gap-1.5 self-start disabled:cursor-not-allowed disabled:opacity-60`}
            data-testid="analysis-copy-last"
          >
            <Copy className="size-4 shrink-0" strokeWidth={2.25} aria-hidden />
            {copying ? t("copy_last_busy") : t("copy_last")}
          </button>
        ) : null}
      </div>
      {copyError ? (
        <p role="alert" className="text-sm font-semibold text-[var(--color-danger)]">
          {copyError}
        </p>
      ) : null}
      <FormError message={entry.error} />

      {ready ? (
        <AnalysisMockExamForm
          subjects={subjects}
          scores={entry.scores}
          submitting={entry.submitting}
          publisherName={entry.publisherName}
          takenAtDate={entry.takenAtDate}
          onPublisherChange={entry.setPublisherName}
          onTakenAtChange={entry.setTakenAtDate}
          onScoreChange={entry.updateScore}
          onSubmit={(event) => void entry.submit(event)}
        />
      ) : (
        <EmptyState
          title={t("no_seed_chip")}
          description={t("no_seed_desc")}
          puhuVariant="sleepy"
        />
      )}
    </section>
  );
}
