"use client";

import { useFormatter, useTranslations } from "next-intl";
import { Sparkles } from "lucide-react";
import type { WeeklyRecapReportDto } from "@mentor/types";
import { Link } from "@/i18n/navigation";
import { PuhuImage } from "@/components/puhu-image";
import { LEDGE, LEDGE_FILLED, PANEL_CARD, PANEL_CARD_TITLE, PANEL_HERO, PANEL_HERO_TITLE, PANEL_MAIN_CLASS, PANEL_TEXT_LINK } from "@/components/panel/panel-styles";
import { WeeklyDeepAnalysisSubjects } from "./weekly-deep-analysis-subjects";

export function WeeklyDeepAnalysis({ report, onStory }: { report: WeeklyRecapReportDto; onStory: () => void }) {
  const t = useTranslations("analysis.report");
  const format = useFormatter();
  const { review, narration } = report;
  const detail = review.deepAnalysis;
  const task = review.suggestedTask;
  return <main className={`${PANEL_MAIN_CLASS} max-w-3xl`} data-testid="weekly-deep-analysis">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <Link href="/analysis" className={PANEL_TEXT_LINK}>{t("back")}</Link>
      <button type="button" onClick={onStory} className={PANEL_TEXT_LINK}>{t("story")}</button>
    </div>
    <header className={PANEL_HERO}>
      <p className="text-sm font-bold text-[var(--color-secondary)]">{format.dateTimeRange(
        new Date(`${report.weekStart}T00:00:00Z`), new Date(`${report.endDate}T00:00:00Z`),
        { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" },
      )}</p>
      <h1 tabIndex={-1} className={PANEL_HERO_TITLE}>{t("title")}</h1>
      <p className="text-sm leading-relaxed text-[var(--color-secondary)]">{t("saved")}</p>
    </header>

    {detail ? <>
      <section className={PANEL_CARD} aria-labelledby="deep-rhythm-title">
        <h2 id="deep-rhythm-title" className={PANEL_CARD_TITLE}>{t("rhythm")}</h2>
        <ul className="mt-4 space-y-4">{detail.metrics.map((metric) => <li key={metric.id}>
          <h3 className="text-sm font-extrabold text-[var(--color-main)]">{t(`metric_${metric.id}`)}</h3>
          <p className="mt-1 text-sm leading-relaxed text-[var(--color-secondary)]">{metric.message}</p>
        </li>)}</ul>
      </section>
      <WeeklyDeepAnalysisSubjects subjects={detail.subjects} />
      <section className={PANEL_CARD} aria-labelledby="deep-evidence-title">
        <h2 id="deep-evidence-title" className={PANEL_CARD_TITLE}>{t("evidence")}</h2>
        <p className="mt-3 text-sm leading-relaxed text-[var(--color-secondary)]">{detail.evidenceMessage}</p>
      </section>
    </> : <section className={PANEL_CARD}>
      <h2 className={PANEL_CARD_TITLE}>{t("legacy_title")}</h2>
      <p className="mt-3 text-sm leading-relaxed text-[var(--color-secondary)]">{t("legacy_detail")}</p>
      <p className="mt-3 text-sm text-[var(--color-main)]">{review.rhythm.message}</p>
      <p className="mt-2 text-sm text-[var(--color-main)]">{review.plan.message}</p>
      {review.performance ? <p className="mt-2 text-sm text-[var(--color-main)]">{review.performance.message}</p> : null}
    </section>}

    <section className={`${PANEL_CARD} flex items-start gap-3`} aria-labelledby="deep-note-title">
      <PuhuImage variant="encouraging" size="sm" />
      <div className="min-w-0">
        <h2 id="deep-note-title" className={`${PANEL_CARD_TITLE} flex items-center gap-2`}>
          <Sparkles className="size-4 shrink-0" aria-hidden />{t("ai_note")}
        </h2>
        <p className="mt-3 text-pretty text-sm leading-relaxed text-[var(--color-main)]">{narration.narration}</p>
      </div>
    </section>

    {review.focus || task ? <section className={PANEL_CARD} aria-labelledby="deep-next-title">
      <h2 id="deep-next-title" className={PANEL_CARD_TITLE}>{t("next_step")}</h2>
      {review.focus ? <p className="mt-3 text-sm leading-relaxed text-[var(--color-secondary)]">{review.focus.message}</p> : null}
      {task ? <>
        <p className="mt-3 font-bold text-[var(--color-main)]">{task.title}</p>
        <Link href={{ pathname: "/plan", query: { add: "1", title: task.title, ...(task.subject ? { subject: task.subject } : {}) } }}
          className={`${LEDGE} ${LEDGE_FILLED} mt-4 w-full`}>{t("add_to_plan")}</Link>
      </> : null}
    </section> : null}
  </main>;
}
