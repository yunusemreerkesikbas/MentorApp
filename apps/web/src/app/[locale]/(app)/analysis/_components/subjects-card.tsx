"use client";

import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { useTranslations } from "next-intl";
import type { CoachingAnalysisDto } from "@mentor/types";
import { Chip } from "@mentor/ui";
import { InfoTooltip } from "@/components/info-tooltip";
import { PANEL_CARD, PANEL_CARD_TITLE } from "@/components/panel/panel-styles";
import { ProgressLine } from "@/components/panel/progress-line";

/** Below ±0.05 net an arrow would be noise. */
const STEADY = 0.05;

/**
 * "Derslerin": each subject's average net drawn as a share of its questions (the server's
 * normalized percent), with where the last four exams went against it. Replaces the tile grid.
 */
export function SubjectsCard({ analysis }: { analysis: CoachingAnalysisDto }) {
  const t = useTranslations("analysis.subjects_card");
  if (analysis.subjects.length === 0) return null;
  const focusRef = analysis.nextFocus?.subjectRef ?? null;

  return (
    <section className={`${PANEL_CARD} flex flex-col gap-4`} aria-labelledby="analysis-subjects-title">
      <div className="flex items-center justify-between gap-3">
        <h2 id="analysis-subjects-title" className={PANEL_CARD_TITLE}>
          {t("title")}
        </h2>
        <span className="flex items-center gap-1 text-caption font-bold text-[var(--color-secondary)]">
          {t("caption")}
          <InfoTooltip text={t("info")} />
        </span>
      </div>
      <ul className="flex flex-col gap-4">
        {analysis.subjects.map((subject) => {
          const delta = subject.netDelta != null ? Number(subject.netDelta) : 0;
          const signed = delta > 0 ? `+${subject.netDelta}` : subject.netDelta;
          const percent =
            subject.normalizedAveragePercent != null
              ? Math.round(Number(subject.normalizedAveragePercent))
              : null;
          return (
            <li key={subject.subjectRef} className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                {/* A long name wraps; the numbers never do. */}
                <span className="min-w-0 text-sm font-extrabold leading-snug text-[var(--color-main)]">
                  {subject.subjectName}
                </span>
                {subject.subjectRef === focusRef ? <Chip size="sm">{t("focus")}</Chip> : null}
                <span className="flex-1" />
                {Math.abs(delta) >= STEADY ? (
                  <span
                    className={`inline-flex shrink-0 items-center gap-0.5 text-caption font-extrabold tabular-nums ${delta > 0 ? "text-[var(--color-success)]" : "text-[var(--color-secondary)]"}`}
                  >
                    {delta > 0 ? (
                      <ArrowUpRight className="size-3.5" strokeWidth={2.6} aria-hidden />
                    ) : (
                      <ArrowDownRight className="size-3.5" strokeWidth={2.6} aria-hidden />
                    )}
                    <span className="sr-only">{t("trend_aria")}</span>
                    {signed}
                  </span>
                ) : null}
                <span className="shrink-0 whitespace-nowrap text-body-sm font-extrabold tabular-nums text-[var(--color-main)]">
                  {subject.averageNet}
                  {subject.questionCount != null ? (
                    <span className="text-caption font-bold text-[var(--color-secondary)]">
                      {" "}
                      / {subject.questionCount}
                    </span>
                  ) : null}
                </span>
              </div>
              {percent != null ? (
                <ProgressLine
                  label={t("bar_label", { subject: subject.subjectName, percent })}
                  value={percent}
                  max={100}
                />
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
