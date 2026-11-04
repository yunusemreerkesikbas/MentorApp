"use client";

import { useFormatter, useTranslations } from "next-intl";
import { Check, ChevronLeft, Info, Play } from "lucide-react";
import type { WeeklyRecapReportDto } from "@mentor/types";
import { Link } from "@/i18n/navigation";
import { CompanionBubble } from "@/components/panel/companion-bubble";
import { PANEL_CARD, PANEL_CARD_TITLE, PANEL_HERO, PANEL_HERO_TITLE, PANEL_MAIN_CLASS, PANEL_TEXT_LINK } from "@/components/panel/panel-styles";
import { pickWeeklyVerdict } from "@/lib/weekly-deep-analysis";
import { EYEBROW, WeeklyDeepAnalysisRhythm } from "./weekly-deep-analysis-parts";
import { WeeklyDeepAnalysisSubjects } from "./weekly-deep-analysis-subjects";
import { useWeeklyReportFollowUp, WeeklyNextStep, WeeklyPreviousStep } from "./weekly-report-follow-up";

/** One finding, then one step: the hero names the week's gain, the next card holds the only ledge. */
export function WeeklyDeepAnalysis({ report, onStory }: { report: WeeklyRecapReportDto; onStory: () => void }) {
  const t = useTranslations("analysis.report");
  const format = useFormatter();
  const { review, narration } = report;
  const detail = review.deepAnalysis;
  const followUp = useWeeklyReportFollowUp(report.id);
  const verdict = useVerdict(report);
  // Alone, the first card takes the row; it halves only when last week's step loads beside it.
  const solo = followUp.state.kind !== "ready" || !followUp.state.data.previous ? "lg:col-span-2" : "";
  const legacyLines = [review.rhythm.message, review.plan.message, review.performance?.message].filter((line): line is string => Boolean(line));
  return <main className={`${PANEL_MAIN_CLASS} max-w-5xl`} data-testid="weekly-deep-analysis">
    <Link href="/analysis" className={`${PANEL_TEXT_LINK} self-start`}><ChevronLeft className="size-4" aria-hidden />{t("back")}</Link>

    <header className={PANEL_HERO}>
      <p className={EYEBROW}>{t("eyebrow", { range: format.dateTimeRange(
        new Date(`${report.weekStart}T00:00:00Z`), new Date(`${report.endDate}T00:00:00Z`),
        { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" },
      ) })}</p>
      <h1 tabIndex={-1} className={`${PANEL_HERO_TITLE} max-w-[40ch] text-balance focus:outline-none`}>{verdict}</h1>
      {detail && review.recap.weeklyTitle ? <span className="-mt-1 inline-flex h-7 self-start items-center rounded-full bg-[var(--play-well-violet)] px-3 text-sm font-extrabold text-[var(--color-main)]">
        {t("nickname", { label: review.recap.weeklyTitle.label })}
      </span> : null}
      <CompanionBubble puhu="encouraging" text={narration.narration} aiLabel={t("ai_note")} />
      <button type="button" onClick={onStory} className={`${PANEL_TEXT_LINK} self-start`}>
        <Play className="size-4 fill-current" aria-hidden />{t("story")}
      </button>
    </header>

    <WeeklyNextStep report={report} state={followUp.state} onRetry={followUp.retry} />

    <div className="grid items-start gap-5 lg:grid-cols-2">
      {detail ? <WeeklyDeepAnalysisRhythm metrics={detail.metrics} className={solo} /> : <section className={`${PANEL_CARD} flex flex-col gap-3 ${solo}`} aria-labelledby="deep-legacy-title">
        <h2 id="deep-legacy-title" className={PANEL_CARD_TITLE}>{t("legacy_title")}</h2>
        <ul className="flex flex-col gap-2.5">{legacyLines.map((line) => <li key={line} className="flex items-start gap-2.5">
          <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--color-success)_14%,var(--color-surface))] text-[var(--color-success)]">
            <Check className="size-3.5" strokeWidth={3} aria-hidden />
          </span>
          <span className="text-sm leading-relaxed text-[var(--color-main)]">{line}</span>
        </li>)}</ul>
        <p className="text-caption leading-relaxed text-[var(--color-secondary)]">{t("legacy_detail")}</p>
      </section>}
      <WeeklyPreviousStep state={followUp.state} />
    </div>

    {detail ? <WeeklyDeepAnalysisSubjects subjects={detail.subjects} /> : null}

    <p className="flex max-w-prose items-start gap-1.5 px-1 text-caption leading-relaxed text-[var(--color-secondary)]">
      <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{detail?.evidenceMessage ? `${detail.evidenceMessage} ` : ""}{t("footnote")}</span>
    </p>
  </main>;
}

function useVerdict(report: WeeklyRecapReportDto): string {
  const t = useTranslations("analysis.report");
  const format = useFormatter();
  const { review } = report;
  const fallback = review.recap.weeklyTitle?.message ?? review.recap.closingMessage;
  if (!review.deepAnalysis) return fallback;
  const { metric, subject } = pickWeeklyVerdict(review.deepAnalysis);
  const delta = subject ? format.number(subject.delta, { maximumFractionDigits: 2, signDisplay: "exceptZero" }) : "";
  if (!metric) return subject ? t("verdict_subject_only", { subject: subject.name, delta }) : fallback;
  const gain = t(`verdict_metric_${metric.id}`, { previous: metric.previous, current: metric.current });
  return subject ? t("verdict_with_subject", { metric: gain, subject: subject.name, delta }) : t("verdict_metric_only", { metric: gain });
}
