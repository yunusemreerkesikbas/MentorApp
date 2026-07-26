"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { ExamSubjectDto, ExamSummaryDto, MockExamDto } from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import { Card, SectionHeading } from "@mentor/ui";
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
}

function NoExamSeed() {
  const translate = useTranslations("analysis");
  return (
    <div className="mt-4 flex flex-col items-center gap-4 py-4 text-center">
      <span
        className="rounded-[var(--radius-card)] px-4 py-2 text-sm font-bold capitalize"
        style={{
          backgroundColor: "color-mix(in srgb, var(--color-chip) 30%, transparent)",
          color: "var(--color-chip-text)",
        }}
      >
        {translate("no_seed_chip")}
      </span>
      <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
        {translate("no_seed_desc")}
      </p>
    </div>
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
      <SectionHeading
        subtitle={exam?.name}
        action={
          canCopy ? (
            <button
              type="button"
              onClick={() => void handleCopyLast()}
              disabled={copying}
              className="min-h-11 text-sm font-semibold underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] disabled:opacity-60"
              style={{ color: "var(--color-main)" }}
              data-testid="analysis-copy-last"
            >
              {copying ? t("copy_last_busy") : t("copy_last")}
            </button>
          ) : undefined
        }
      >
        {t("result_entry_title")}
      </SectionHeading>
      {copyError ? (
        <p
          className="mt-2 text-sm"
          style={{ color: "var(--color-danger)" }}
          role="alert"
        >
          {copyError}
        </p>
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
