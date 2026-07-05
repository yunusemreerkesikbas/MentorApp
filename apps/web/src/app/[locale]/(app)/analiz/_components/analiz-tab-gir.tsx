"use client";

import { useTranslations } from "next-intl";
import type { ExamSubjectDto, ExamSummaryDto } from "@mentor/types";
import { Card, SectionHeading } from "@mentor/ui";
import type { SubjectScores } from "./analiz-types";
import { AnalizHistoryList } from "./analiz-history-list";
import { AnalizMockExamForm } from "./analiz-mock-exam-form";

interface AnalizTabGirProps {
  exam: ExamSummaryDto | null;
  subjects: ExamSubjectDto[];
  scores: Record<string, SubjectScores>;
  submitting: boolean;
  historyRefreshKey: number;
  publisherName: string;
  takenAtDate: string;
  onPublisherChange: (value: string) => void;
  onTakenAtChange: (value: string) => void;
  onScoreChange: (slug: string, field: keyof SubjectScores, value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCopyLast: (exam: import("@mentor/types").MockExamDto) => void;
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

export function AnalizTabGir({
  exam,
  subjects,
  scores,
  submitting,
  historyRefreshKey,
  publisherName,
  takenAtDate,
  onPublisherChange,
  onTakenAtChange,
  onScoreChange,
  onSubmit,
  onCopyLast,
}: AnalizTabGirProps) {
  const t = useTranslations("analysis");

  return (
    <div className="flex flex-col gap-6">
      <Card id="analiz-form">
        <SectionHeading subtitle={exam?.name}>{t("result_entry_title")}</SectionHeading>
        {!exam || subjects.length === 0 ? (
          <NoExamSeed />
        ) : (
          <AnalizMockExamForm
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
        )}
      </Card>
      <AnalizHistoryList refreshKey={historyRefreshKey} onCopyLast={onCopyLast} />
    </div>
  );
}
