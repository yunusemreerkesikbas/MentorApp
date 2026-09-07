"use client";

import { CheckCircle2, Circle } from "lucide-react";
import { useTranslations } from "next-intl";
import type { CoachingAnalysisDto } from "@mentor/types";
import { Card, Chip, SectionHeading } from "@mentor/ui";
import { Link } from "@/i18n/navigation";
import { trackAnalysisAction } from "@/lib/analytics";
import { analysisCycleView } from "@/lib/analysis-cycle-view";
import { buildAnalysisCoachHref } from "./analysis-types";

export function AnalysisImprovementLoopCard({
  analysis,
  examId,
}: {
  analysis: CoachingAnalysisDto;
  examId: string;
}) {
  const t = useTranslations("analysis.improvement_cycle");
  const focusT = useTranslations("analysis.focus");
  const cycle = analysis.improvementCycle;
  const { focus, coachMockExamId: baselineMockExamId, proposal } = analysisCycleView(analysis);
  if (!focus) return null;
  const track = (action: "plan" | "notebook" | "coach") => trackAnalysisAction({
    action,
    focusSource: focus.source,
    cycleState: cycle?.steps.closed ? "closed" : cycle?.steps.measured ? "measured" : cycle?.steps.practiced ? "practiced" : cycle ? "planned" : "signal",
  });

  const steps = [
    { key: "signal", done: true },
    { key: "planned", done: Boolean(cycle) },
    { key: "practiced", done: cycle?.steps.practiced ?? false },
    { key: "measured", done: cycle?.steps.measured ?? false },
  ] as const;
  const coachSeed = focus.topicName
    ? focusT("coach_seed", { subject: focus.subjectName, topic: focus.topicName })
    : focusT("coach_seed_subject", { subject: focus.subjectName });

  return (
    <Card className="flex flex-col gap-5" data-testid="analysis-improvement-cycle">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <SectionHeading subtitle={cycle?.message ?? analysis.nextFocus?.message}>
          {t("title")}
        </SectionHeading>
        <Chip>{t(focus.source === "PHOTO_SIGNAL" ? "source_notebook" : "source_average")}</Chip>
      </div>

      <div>
        <p className="text-xl font-bold" style={{ color: "var(--color-main)" }}>
          {focus.subjectName}
        </p>
        {focus.topicName ? (
          <p className="text-sm font-semibold" style={{ color: "var(--color-body)" }}>
            {focus.topicName}
          </p>
        ) : null}
      </div>

      <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((step) => {
          const Icon = step.done ? CheckCircle2 : Circle;
          return (
            <li
              key={step.key}
              className="flex min-h-14 items-center gap-2 rounded-[var(--radius-card)] border px-3 py-2 text-sm font-semibold"
              style={{
                borderColor: "var(--color-border)",
                color: step.done ? "var(--color-main)" : "var(--color-secondary)",
              }}
            >
              <Icon
                className="size-4 shrink-0"
                aria-hidden
                style={{ color: step.done ? "var(--color-success)" : "var(--color-secondary)" }}
              />
              {t(`steps.${step.key}`)}
              <span className="sr-only">: {t(step.done ? "done" : "pending")}</span>
            </li>
          );
        })}
      </ol>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {proposal ? (
          <div className="flex w-full flex-col gap-2" data-testid="analysis-next-proposal">
          {cycle ? <div><h3 className="font-semibold">{t("new_focus")}</h3><p>{proposal.subjectName}{proposal.topicName ? ` · ${proposal.topicName}` : ""}</p></div> : null}
          {proposal.recentTrend[0] ? (
          <Link
            onClick={() => trackAnalysisAction({ action: "plan", focusSource: proposal.source, cycleState: "signal" })}
            href={{
              pathname: "/plan",
              query: {
                add: "1",
                source: "analysis",
                examId,
                baselineMockExamId: proposal.recentTrend[0].mockExamId,
                subjectRef: proposal.subjectRef,
                ...(proposal.topicRef && { topicRef: proposal.topicRef }),
                subject: proposal.subjectName,
                ...(proposal.topicName && { topic: proposal.topicName }),
                title: proposal.suggestedTaskTitle,
              },
            }}
            className="flex min-h-11 items-center justify-center rounded-[var(--radius-card)] px-5 py-3 text-sm font-bold text-[var(--color-btn-label)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
            style={{ backgroundColor: "var(--color-btn)" }}
          >
            {t(cycle ? "add_new_focus" : "add_to_plan")}
          </Link>
          ) : <Link href={{ pathname: "/analysis", query: { tab: "entry" } }}>{t("first_exam")}</Link>}
          </div>
        ) : null}
        {!baselineMockExamId && !cycle && !proposal ? (
          <Link href={{ pathname: "/analysis", query: { tab: "entry" } }} className="flex min-h-11 items-center rounded-[var(--radius-card)] px-4 text-sm font-bold focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]">
            {t("first_exam")}
          </Link>
        ) : null}
        {cycle ? (
          <Link href="/plan" className="flex min-h-11 items-center px-4 text-sm font-bold">{t("open_plan")}</Link>
        ) : null}
        <Link onClick={() => track("notebook")} href={{ pathname: "/notebook", query: { panel: "index", examId, subjectRef: focus.subjectRef, ...(focus.topicRef && { topicRef: focus.topicRef }) } }} className="flex min-h-11 items-center px-4 text-sm font-bold">{t("review")}</Link>
        {baselineMockExamId ? <Link
          onClick={() => track("coach")}
          href={buildAnalysisCoachHref(coachSeed, baselineMockExamId)}
          className="flex min-h-11 items-center justify-center rounded-[var(--radius-card)] border px-5 py-3 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
          style={{ borderColor: "var(--color-border)", color: "var(--color-btn)" }}
        >
          {t("coach")}
        </Link> : null}
      </div>
    </Card>
  );
}
