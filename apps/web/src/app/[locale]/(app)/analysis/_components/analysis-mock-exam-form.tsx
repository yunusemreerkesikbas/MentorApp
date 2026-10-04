"use client";
import { CalendarDays, Check } from "lucide-react";

import { useMemo, useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { ExamSubjectDto } from "@mentor/types";
import { Button, TextField } from "@mentor/ui";
import { useMentorBottomSheet } from "@/lib/mentor-bottom-sheet";
import {
  AnalysisDatePickerSheet,
  type AnalysisDatePickerSheetHandle,
} from "./analysis-date-picker-sheet";
import { paperSubjects, subjectTotal, withScore } from "./analysis-types";
import type { SubjectScores } from "./analysis-types";

const FIELDS = ["correct", "wrong", "blank"] as const;
/** Subject, three counts and the row's tally; the desktop header uses the same columns. */
const ROW_GRID = "sm:grid-cols-[minmax(0,1fr)_repeat(3,6rem)_4.5rem] sm:items-center sm:gap-2.5";
const HAIRLINE = "border-t border-[color-mix(in_srgb,var(--color-main)_7%,transparent)]";
const SCORE_FIELD =
  "h-12 w-full min-w-0 rounded-[var(--radius-card)] border px-2 text-center text-base font-extrabold tabular-nums shadow-[var(--shadow-card)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";
const SCORE_TONE = {
  plain: "border-[var(--color-border)] bg-[var(--color-surface-translucent)] text-[var(--color-main)]",
  /** A blank the form filled in: tinted so it reads as a suggestion the student can overwrite. */
  auto: "border-[var(--color-border)] bg-[var(--play-selected)] text-[var(--play-selected-ink)]",
  error: "border-[var(--color-danger)] bg-[var(--color-surface-translucent)] text-[var(--color-main)]",
};

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
  /** The whole row, blank already worked out (`withScore`). */
  onScoreChange: (slug: string, row: SubjectScores) => void;
  onSubmit: (e: React.FormEvent) => void;
  submitLabel?: string;
  onCancel?: () => void;
}

/**
 * The mock exam form, shared by "Deneme ekle" and the history's edit sheet: publisher and date, then
 * one row per subject with its tally, blank filled in from the other two until the student types it.
 */
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
  const scoredSubjects = useMemo(() => paperSubjects(subjects), [subjects]);
  const overSubject = scoredSubjects.find((subject) => {
    const row = scores[subject.slug];
    return row && subject.questionCount != null && subjectTotal(row) > subject.questionCount;
  });

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
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
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
            className="flex min-h-11 w-full cursor-pointer items-center justify-between gap-2 rounded-[var(--radius-card)] border bg-[color-mix(in_srgb,var(--color-surface)_50%,transparent)] px-5 py-3 text-left text-base outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
            style={{
              color: "var(--color-body)",
              boxShadow: "var(--shadow-card)",
              fontFamily: "var(--font-body)",
              borderColor: "var(--color-border)",
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

      <div className="flex flex-col gap-2.5">
        <div
          aria-hidden
          className={`hidden text-xs font-semibold text-[var(--color-secondary)] sm:grid ${ROW_GRID}`}
        >
          <span>{t("history.col_subject")}</span>
          {FIELDS.map((field) => (
            <span key={field} className="text-center">
              {t(field)}
            </span>
          ))}
        </div>
        <p className="text-xs font-semibold text-[var(--color-secondary)]">{t("entry.blank_hint")}</p>

        {scoredSubjects.map((subject) => {
          const row = scores[subject.slug];
          const max = subject.questionCount;
          if (!row || max == null) return null;
          const total = subjectTotal(row);
          const over = total > max;
          const errorId = `analysis-row-error-${subject.slug}`;
          const tally = <RowTally total={total} max={max} />;

          return (
            <fieldset key={subject.slug} className={`m-0 min-w-0 border-0 p-0 ${HAIRLINE}`}>
              <legend className="sr-only">
                {subject.name}, {t("questions_count", { count: max })}
              </legend>
              <div className={`flex flex-col gap-2 pt-3 sm:grid sm:pt-2 ${ROW_GRID}`}>
                <div className="flex items-baseline gap-1.5 sm:flex-col sm:gap-0">
                  <span className="text-body-sm font-extrabold text-[var(--color-main)]">
                    {subject.name}
                  </span>
                  <span className="text-caption text-[var(--color-secondary)]">
                    {t("questions_count", { count: max })}
                  </span>
                  <span className="ml-auto sm:hidden">{tally}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 sm:contents">
                  {FIELDS.map((field) => {
                    const auto = field === "blank" && !row.blankManual && row.blank !== "";
                    return (
                      <label key={field} className="flex min-w-0 flex-col gap-1">
                        <span className="text-center text-xs font-semibold text-[var(--color-secondary)] sm:sr-only">
                          {t(field)}
                        </span>
                        <input
                          type="number"
                          min={0}
                          inputMode="numeric"
                          value={row[field]}
                          aria-invalid={over || undefined}
                          aria-describedby={over ? errorId : undefined}
                          onChange={(event) =>
                            onScoreChange(subject.slug, withScore(row, field, event.target.value, max))
                          }
                          className={`${SCORE_FIELD} ${over ? SCORE_TONE.error : auto ? SCORE_TONE.auto : SCORE_TONE.plain}`}
                        />
                      </label>
                    );
                  })}
                </div>
                <span className="hidden justify-end sm:flex">{tally}</span>
              </div>
              {over ? (
                <p
                  id={errorId}
                  role="alert"
                  className="pt-2 text-caption font-bold text-[var(--color-danger)]"
                >
                  {t("validation_over_count", { subject: subject.name, total, max })}
                </p>
              ) : null}
            </fieldset>
          );
        })}
      </div>

      <div className={onCancel ? "grid gap-2 sm:grid-cols-2" : "flex flex-col gap-2 sm:items-end"}>
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
          className={onCancel ? undefined : "sm:w-auto sm:min-w-52"}
          disabled={overSubject != null}
        >
          {submitLabel ?? t("save")}
        </Button>
        {overSubject ? (
          <p className="text-center text-caption text-[var(--color-secondary)] sm:col-span-full sm:text-right">
            {t("entry.fix_row", { subject: overSubject.name })}
          </p>
        ) : null}
      </div>
    </form>
  );
}

/** "27/30": how much of the subject is entered; a full row gets a tick, an overfull one turns red. */
function RowTally({ total, max }: { total: number; max: number }) {
  const tone =
    total > max
      ? "text-[var(--color-danger)]"
      : total === max
        ? "text-[var(--color-success)]"
        : "text-[var(--color-secondary)]";
  return (
    <span aria-hidden className={`inline-flex items-center gap-1 text-caption font-extrabold tabular-nums ${tone}`}>
      {total === max ? <Check className="size-3.5" strokeWidth={2.8} /> : null}
      {total}/{max}
    </span>
  );
}
