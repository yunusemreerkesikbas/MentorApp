"use client";
import { Copy } from "lucide-react";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { ExamSubjectDto, ExamSummaryDto, MockExamDto } from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import { Button, Card, SectionHeading } from "@mentor/ui";
import { EmptyState } from "@/components/empty-state";
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
      <SectionHeading subtitle={exam?.name}>
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
            headerAction={
              canCopy ? (
                <Button
                  type="button"
                  variant="secondary"
                  busy={copying}
                  onClick={() => void handleCopyLast()}
                  data-testid="analysis-copy-last"
                >
                  <Copy className="size-4 shrink-0" strokeWidth={2.25} aria-hidden />
                  {copying ? t("copy_last_busy") : t("copy_last")}
                </Button>
              ) : undefined
            }
          />
        </div>
      )}
    </Card>
  );
}
