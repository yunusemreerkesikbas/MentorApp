"use client";
import { Copy, NotebookPen, X } from "lucide-react";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { ExamSubjectDto, ExamSummaryDto, MockExamDto } from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import { Card, SectionHeading } from "@mentor/ui";
import { EmptyState } from "@/components/empty-state";
import { Link } from "@/i18n/navigation";
import { fetchMockExamsList } from "@/lib/mock-exams";
import type { SubjectScores } from "./analysis-types";
import { AnalysisMockExamForm } from "./analysis-mock-exam-form";

interface AnalysisTabEntryProps {
  exam: ExamSummaryDto | null;
  subjects: ExamSubjectDto[];
  scores: Record<string, SubjectScores>;
  submitting: boolean;
  publisherName: string;
  takenAtDate: string;
  onPublisherChange: (value: string) => void;
  onTakenAtChange: (value: string) => void;
  onScoreChange: (slug: string, field: keyof SubjectScores, value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCopyLast: (exam: MockExamDto) => void;
  /** Set for the moment after a save that had wrong answers in it; null the rest of the time. */
  notebookHandoff: { mockExamId: string; wrongTotal: number } | null;
  onDismissNotebookHandoff: () => void;
}

function NoExamSeed() {
  const translate = useTranslations("analysis");
  return (
    <EmptyState
      className="mt-4"
      title={translate("no_seed_chip")}
      description={translate("no_seed_desc")}
      puhuVariant="sleepy"
    />
  );
}

export function AnalysisTabEntry({
  exam,
  subjects,
  scores,
  submitting,
  publisherName,
  takenAtDate,
  onPublisherChange,
  onTakenAtChange,
  onScoreChange,
  onSubmit,
  onCopyLast,
  notebookHandoff,
  onDismissNotebookHandoff,
}: AnalysisTabEntryProps) {
  const t = useTranslations("analysis");
  const [copying, setCopying] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);

  async function handleCopyLast() {
    if (!exam?.id || copying) return;
    setCopying(true);
    setCopyError(null);
    try {
      const response = await fetchMockExamsList(1, 1, exam.id);
      const latest = response.items[0];
      if (!latest) {
        setCopyError(t("copy_last_empty"));
        return;
      }
      onCopyLast(latest);
    } catch (error) {
      setCopyError(
        error instanceof ApiClientError
          ? error.message
          : error instanceof Error
            ? error.message
            : String(error),
      );
    } finally {
      setCopying(false);
    }
  }

  const canCopy = Boolean(exam && subjects.length > 0);

  return (
    <Card id="analysis-form">
      <div className="flex items-start justify-between gap-3">
        <SectionHeading subtitle={exam?.name}>
          {t("result_entry_title")}
        </SectionHeading>
        {canCopy ? (
          <button
            type="button"
            onClick={() => void handleCopyLast()}
            disabled={copying}
            className="inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-[var(--radius-card)] border px-3 text-xs font-semibold transition-colors hover:bg-[color-mix(in_srgb,var(--color-surface)_60%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none"
            style={{
              color: "var(--color-main)",
              borderColor: "color-mix(in srgb, var(--color-main) 15%, transparent)",
            }}
            data-testid="analysis-copy-last"
          >
            <Copy className="size-3.5 shrink-0" strokeWidth={2.25} aria-hidden />
            {copying ? t("copy_last_busy") : t("copy_last")}
          </button>
        ) : null}
      </div>
      {copyError ? (
        <p
          className="mt-2 text-sm"
          style={{ color: "var(--color-danger)" }}
          role="alert"
        >
          {copyError}
        </p>
      ) : null}
      {/*
        A count, not an import. Twelve entries created automatically would be twelve cards the
        student never looked at, which is the one thing the review deck cannot survive — they pick
        which mistakes are worth filing, one at a time, with their own reason attached.
      */}
      {notebookHandoff ? (
        <div
          // Two rows on a phone, one on a wider screen. As a single wrapping row the sentence was
          // squeezed between the icon, the button and the dismiss into a column of single words —
          // `flex-1` + `min-w-0` shrinks text before it wraps siblings.
          className="mt-4 flex flex-col gap-3 rounded-[var(--radius-card)] p-4 sm:flex-row sm:items-center"
          style={{
            backgroundColor: "var(--color-accent-soft)",
            border: "1px solid color-mix(in srgb, var(--color-main) 10%, transparent)",
          }}
        >
          <div className="flex min-w-0 flex-1 items-start gap-3 sm:items-center">
            <NotebookPen
              aria-hidden
              size={18}
              className="mt-0.5 shrink-0 sm:mt-0"
              style={{ color: "var(--color-main)" }}
            />
            <p
              className="min-w-0 text-sm text-pretty"
              style={{ color: "var(--color-main)" }}
            >
              {t("notebook_handoff", { count: notebookHandoff.wrongTotal })}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
          <Link
            href={{
              pathname: "/notebook",
              query: { mockExam: notebookHandoff.mockExamId },
            }}
            className="inline-flex min-h-11 items-center rounded-[var(--radius-card)] px-4 text-sm font-bold text-[var(--color-btn-label)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
            style={{ backgroundColor: "var(--color-btn)" }}
          >
            {t("notebook_handoff_action")}
          </Link>
          <button
            type="button"
            aria-label={t("notebook_handoff_dismiss")}
            onClick={onDismissNotebookHandoff}
            className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full outline-none hover:bg-[var(--color-surface-container)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
            style={{ color: "var(--color-main)" }}
          >
            <X aria-hidden size={16} />
          </button>
          </div>
        </div>
      ) : null}

      {!exam || subjects.length === 0 ? (
        <NoExamSeed />
      ) : (
        <div className="mt-4">
          <AnalysisMockExamForm
            subjects={subjects}
            scores={scores}
            submitting={submitting}
            publisherName={publisherName}
            takenAtDate={takenAtDate}
            onPublisherChange={onPublisherChange}
            onTakenAtChange={onTakenAtChange}
            onScoreChange={onScoreChange}
            onSubmit={onSubmit}
          />
        </div>
      )}
    </Card>
  );
}
