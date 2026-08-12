"use client";
import { CalendarDays } from "lucide-react";

import { useMemo, useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { ExamSubjectDto } from "@mentor/types";
import { Button, TextField } from "@mentor/ui";
import { useMentorBottomSheet } from "@/lib/mentor-bottom-sheet";
import {
  AnalysisDatePickerSheet,
  type AnalysisDatePickerSheetHandle,
} from "./analysis-date-picker-sheet";
import { subjectTotal, validateSubjectCounts } from "./analysis-types";
import type { SubjectScores } from "./analysis-types";

function formatTakenAtLabel(iso: string, locale: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

interface AnalysisMockExamFormProps {
  subjects: ExamSubjectDto[];
  scores: Record<string, SubjectScores>;
  submitting: boolean;
  publisherName: string;
  takenAtDate: string;
  onPublisherChange: (value: string) => void;
  onTakenAtChange: (value: string) => void;
  onScoreChange: (
    slug: string,
    field: keyof SubjectScores,
    value: string,
  ) => void;
  onSubmit: (e: React.FormEvent) => void;
  submitLabel?: string;
  onCancel?: () => void;
}

export function AnalysisMockExamForm({
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
}: AnalysisMockExamFormProps) {
  const t = useTranslations("analysis");
  const locale = useLocale();
  const bottomSheet = useMentorBottomSheet();
  const datePickerRef = useRef<AnalysisDatePickerSheetHandle>(null);
  const invalidSlug = useMemo(
    () => validateSubjectCounts(subjects, scores),
    [subjects, scores],
  );

  async function openDateSheet() {
    await bottomSheet.filterSheet({
      title: t("date_sheet_title"),
      applyLabel: t("date_sheet_apply"),
      children: (
        <AnalysisDatePickerSheet ref={datePickerRef} defaultValue={takenAtDate} />
      ),
      onApply: () => {
        const picked = datePickerRef.current?.getValue() ?? takenAtDate;
        onTakenAtChange(picked);
      },
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TextField
          label={t("publisher_label")}
          value={publisherName}
          onChange={(event) => onPublisherChange(event.target.value)}
          autoComplete="off"
        />
        <label className="flex flex-col gap-1">
          <span
            className="text-xs font-semibold"
            style={{
              color: "var(--color-secondary)",
              fontFamily: "var(--font-heading)",
            }}
          >
            {t("taken_at_label")}
          </span>
          <button
            type="button"
            onClick={() => void openDateSheet()}
            className="flex min-h-11 w-full cursor-pointer items-center justify-between gap-2 rounded-[var(--radius-card)] border bg-white/50 px-5 py-3 text-left text-base outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
            style={{
              color: "var(--color-body)",
              boxShadow: "var(--shadow-card)",
              fontFamily: "var(--font-body)",
              borderColor: "#ffffff",
            }}
            data-testid="analysis-taken-at-trigger"
          >
            {formatTakenAtLabel(takenAtDate, locale)}
            <CalendarDays
              className="size-5 shrink-0"
              style={{ color: "var(--color-secondary)" }}
              strokeWidth={2}
              aria-hidden
            />
          </button>
        </label>
      </div>

      <div
        className="hidden sm:grid sm:grid-cols-[minmax(10rem,1fr)_repeat(3,minmax(4rem,1fr))] sm:gap-2 sm:px-1 sm:pb-1"
        aria-hidden
      >
        <span
          className="text-xs font-semibold"
          style={{ color: "var(--color-secondary)" }}
        >
          {t("result_entry_title")}
        </span>
        {(["correct", "wrong", "blank"] as const).map((field) => (
          <span
            key={field}
            className="text-center text-xs font-semibold"
            style={{ color: "var(--color-secondary)" }}
          >
            {t(field)}
          </span>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        {subjects.map((subject) => {
          const total = subjectTotal(scores[subject.slug]!);
          const isOverCount =
            subject.questionCount != null && total > subject.questionCount;
          const validationMessage =
            isOverCount && subject.questionCount != null
              ? t("validation_over_count", {
                  subject: subject.name,
                  total,
                  max: subject.questionCount,
                })
              : null;

          return (
            <fieldset key={subject.slug} className="m-0 min-w-0 border-0 p-0">
              <legend className="sr-only">
                {subject.name}{" "}
                {subject.questionCount != null
                  ? t("questions_count", { count: subject.questionCount })
                  : ""}
              </legend>
              <div className="grid grid-cols-3 items-start gap-2 sm:grid-cols-[minmax(10rem,1fr)_repeat(3,minmax(4rem,1fr))]">
                <div
                  className="col-span-3 flex min-h-11 items-center text-sm font-bold sm:col-span-1"
                  style={{
                    color: "var(--color-main)",
                    fontFamily: "var(--font-heading)",
                  }}
                >
                  {subject.name}
                  {subject.questionCount != null
                    ? " " +
                      t("questions_count", { count: subject.questionCount })
                    : ""}
                </div>
                {(["correct", "wrong", "blank"] as const).map((field) => (
                  <TextField
                    key={field}
                    label={t(field)}
                    className={[
                      "sm:[&>span:first-child]:sr-only",
                      validationMessage && field !== "blank"
                        ? "[&>span:last-child]:sr-only"
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    type="number"
                    min={0}
                    inputMode="numeric"
                    error={validationMessage ?? undefined}
                    value={scores[subject.slug]?.[field] ?? ""}
                    onChange={(event) =>
                      onScoreChange(subject.slug, field, event.target.value)
                    }
                  />
                ))}
              </div>
            </fieldset>
          );
        })}
      </div>

      <div className={onCancel ? "grid gap-2 sm:grid-cols-2" : "flex justify-end"}>
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
          fullWidth={Boolean(onCancel)}
          disabled={invalidSlug != null}
        >
          {submitLabel ?? t("save")}
        </Button>
      </div>
    </form>
  );
}
