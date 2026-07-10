"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { ExamSubjectDto } from "@mentor/types";
import { Button, TextField } from "@mentor/ui";
import { FormError } from "@/components/form";
import type { SubjectScores } from "./analiz-types";
import { subjectTotal, validateSubjectCounts } from "./analiz-types";

interface AnalizMockExamFormProps {
  subjects: ExamSubjectDto[];
  scores: Record<string, SubjectScores>;
  submitting: boolean;
  publisherName: string;
  takenAtDate: string;
  onPublisherChange: (value: string) => void;
  onTakenAtChange: (value: string) => void;
  onScoreChange: (slug: string, field: keyof SubjectScores, value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  submitLabel?: string;
  onCancel?: () => void;
}

export function AnalizMockExamForm({
  subjects,
  scores,
  submitting,
  publisherName,
  takenAtDate,
  onPublisherChange,
  onTakenAtChange,
  onScoreChange,
  onSubmit,
  submitLabel,
  onCancel,
}: AnalizMockExamFormProps) {
  const t = useTranslations("analysis");

  const invalidSlug = useMemo(
    () => validateSubjectCounts(subjects, scores),
    [subjects, scores],
  );

  const invalidSubject = invalidSlug
    ? subjects.find((s) => s.slug === invalidSlug)
    : null;

  const validationMessage =
    invalidSubject && invalidSubject.questionCount != null
      ? t("validation_over_count", {
          subject: invalidSubject.name,
          total: subjectTotal(scores[invalidSubject.slug]!),
          max: invalidSubject.questionCount,
        })
      : null;

  return (
    <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TextField
          label={t("publisher_label")}
          value={publisherName}
          onChange={(e) => onPublisherChange(e.target.value)}
          autoComplete="off"
        />
        <TextField
          label={t("taken_at_label")}
          type="date"
          value={takenAtDate}
          onChange={(e) => onTakenAtChange(e.target.value)}
        />
      </div>

      <div
        className="hidden sm:grid sm:grid-cols-[1fr_repeat(3,minmax(4rem,1fr))] sm:gap-2 sm:px-1 sm:pb-1"
        aria-hidden
      >
        <span className="text-xs font-semibold" style={{ color: "var(--color-secondary)" }}>
          {t("result_entry_title")}
        </span>
        <span className="text-center text-xs font-semibold" style={{ color: "var(--color-secondary)" }}>
          {t("correct")}
        </span>
        <span className="text-center text-xs font-semibold" style={{ color: "var(--color-secondary)" }}>
          {t("wrong")}
        </span>
        <span className="text-center text-xs font-semibold" style={{ color: "var(--color-secondary)" }}>
          {t("blank")}
        </span>
      </div>

      {subjects.map((s) => (
        <fieldset
          key={s.slug}
          className="grid grid-cols-1 gap-2 border-0 p-0 sm:grid-cols-[1fr_repeat(3,minmax(4rem,1fr))] sm:items-end sm:gap-2"
        >
          <legend
            className="mb-1 text-sm font-bold sm:mb-0"
            style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
          >
            {s.name}
            {s.questionCount != null
              ? ` ${t("questions_count", { count: s.questionCount })}`
              : ""}
          </legend>
          {(["correct", "wrong", "blank"] as const).map((field) => (
            <TextField
              key={field}
              label={t(field)}
              className="sm:[&>span:first-child]:sr-only"
              type="number"
              min={0}
              inputMode="numeric"
              value={scores[s.slug]?.[field] ?? ""}
              onChange={(e) => onScoreChange(s.slug, field, e.target.value)}
            />
          ))}
        </fieldset>
      ))}

      <FormError message={validationMessage} />

      <div className={onCancel ? "grid gap-2 sm:grid-cols-2" : undefined}>
        {onCancel ? (
          <Button
            type="button"
            variant="secondary"
            fullWidth
            disabled={submitting}
            onClick={onCancel}
          >
            {t("history.cancel_edit")}
          </Button>
        ) : null}
        <Button
          type="submit"
          busy={submitting}
          fullWidth
          disabled={invalidSlug != null}
        >
          {submitLabel ?? t("save")}
        </Button>
      </div>
    </form>
  );
}
