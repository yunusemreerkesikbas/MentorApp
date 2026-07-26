"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { ExamSubjectDto, MockExamDto } from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import { FormError } from "@/components/form";
import { updateMockExam } from "@/lib/mock-exams";
import { AnalysisMockExamForm } from "./analysis-mock-exam-form";
import { scoresFromMockExam, type SubjectScores } from "./analysis-types";

interface AnalysisHistoryEditSheetProps {
  detail: MockExamDto;
  subjects: ExamSubjectDto[];
  onSaved: (updated: MockExamDto) => void;
  onCancel: () => void;
}

/**
 * Full-width mock-exam edit form for bottom sheet / dialog (not the narrow history rail).
 */
export function AnalysisHistoryEditSheet({
  detail,
  subjects,
  onSaved,
  onCancel,
}: AnalysisHistoryEditSheetProps) {
  const t = useTranslations("analysis.history");
  const [scores, setScores] = useState<Record<string, SubjectScores>>(() =>
    scoresFromMockExam(subjects, detail.subjects),
  );
  const [publisherName, setPublisherName] = useState(
    detail.publisherName ?? "",
  );
  const [takenAtDate, setTakenAtDate] = useState(detail.takenAt.slice(0, 10));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function updateScore(
    slug: string,
    field: keyof SubjectScores,
    value: string,
  ) {
    setScores((current) => ({
      ...current,
      [slug]: { ...current[slug]!, [field]: value },
    }));
  }

  async function handleUpdate(event: React.FormEvent) {
    event.preventDefault();
    if (saving || !takenAtDate) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await updateMockExam(detail.id, {
        takenAt: new Date(`${takenAtDate}T12:00:00`).toISOString(),
        publisherName: publisherName.trim() || null,
        subjects: subjects.map((subject) => ({
          subjectRef: subject.slug,
          correct: Number(scores[subject.slug]?.correct || 0),
          wrong: Number(scores[subject.slug]?.wrong || 0),
          blank: Number(scores[subject.slug]?.blank || 0),
        })),
      });
      onSaved(updated);
    } catch (updateError) {
      setError(
        updateError instanceof ApiClientError
          ? updateError.message
          : updateError instanceof Error
            ? updateError.message
            : String(updateError),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 pb-2">
      <FormError message={error} />
      <AnalysisMockExamForm
        subjects={subjects}
        scores={scores}
        submitting={saving}
        publisherName={publisherName}
        takenAtDate={takenAtDate}
        onPublisherChange={setPublisherName}
        onTakenAtChange={setTakenAtDate}
        onScoreChange={updateScore}
        onSubmit={(event) => void handleUpdate(event)}
        submitLabel={t("save_edit")}
        onCancel={onCancel}
      />
    </div>
  );
}
