"use client";

import { CheckCircle2, Circle } from "lucide-react";
import { useTranslations } from "next-intl";
import type { CoachingAnalysisDto } from "@mentor/types";
import { Card, SectionHeading } from "@mentor/ui";
import { Link } from "@/i18n/navigation";
import { trackAnalysisAction } from "@/lib/analytics";
import { analysisCycleView } from "@/lib/analysis-cycle-view";
import { buildAnalysisCoachHref } from "./analysis-types";
import styles from "./analysis-review-progress.module.css";

export function AnalysisImprovementLoopCard({
  analysis,
  examId,
  embedded = false,
}: {
  analysis: CoachingAnalysisDto;
  examId: string;
  embedded?: boolean;
}) {
  const t = useTranslations("analysis.improvement_cycle");
  const focusT = useTranslations("analysis.focus");
  const cycle = analysis.improvementCycle;
  const {
    focus,
    coachMockExamId: baselineMockExamId,
    proposal,
  } = analysisCycleView(analysis);
  if (!focus) return null;
  const track = (action: "plan" | "notebook" | "coach") =>
    trackAnalysisAction({
      action,
      focusSource: focus.source,
      cycleState: cycle?.steps.closed
        ? "closed"
        : cycle?.steps.measured
          ? "measured"
          : cycle?.steps.practiced
            ? "practiced"
            : cycle
              ? "planned"
              : "signal",
    });

  const steps = [
    { key: "signal", done: true },
    { key: "planned", done: Boolean(cycle) },
    { key: "practiced", done: cycle?.steps.practiced ?? false },
    { key: "measured", done: cycle?.steps.measured ?? false },
  ] as const;
  const coachSeed = focus.topicName
    ? focusT("coach_seed", {
        subject: focus.subjectName,
        topic: focus.topicName,
      })
    : focusT("coach_seed_subject", { subject: focus.subjectName });

  const Surface = embedded ? "div" : Card;
  return (
    <Surface
      className={styles.cycleRoot}
      data-testid="analysis-improvement-cycle"
    >
      <div className={styles.cycleHeader}>
        <SectionHeading
          subtitle={cycle?.message ?? analysis.nextFocus?.message}
        >
          {t("title")}
        </SectionHeading>
        <span className={styles.signalBadge}>
          <CheckCircle2 size={14} aria-hidden />
          {t(
            focus.source === "PHOTO_SIGNAL"
              ? "source_notebook"
              : "source_average",
          )}
        </span>
      </div>

      <div className={styles.cycleSubject}>
        <p className={styles.cycleSubjectName}>
          {focus.subjectName}
        </p>
        {focus.topicName ? (
          <p className={styles.cycleTopic}>
            {focus.topicName}
          </p>
        ) : null}
      </div>

      <ol className={styles.cycleSteps}>
        {steps.map((step) => {
          const Icon = step.done ? CheckCircle2 : Circle;
          return (
            <li
              key={step.key}
              className={styles.cycleStep}
              data-complete={step.done}
              style={{
                borderColor: "var(--color-border)",
                color: step.done
                  ? "var(--color-main)"
                  : "var(--color-secondary)",
              }}
            >
              <Icon
                className="size-4 shrink-0"
                aria-hidden
                style={{
                  color: step.done
                    ? "var(--color-success)"
                    : "var(--color-secondary)",
                }}
              />
              {t(`steps.${step.key}`)}
              <span className="sr-only">
                : {t(step.done ? "done" : "pending")}
              </span>
            </li>
          );
        })}
      </ol>

      <div className={styles.cycleActions}>
        {proposal ? (
          <div
            className={styles.cycleProposal}
            data-testid="analysis-next-proposal"
          >
            {cycle ? (
              <div>
                <h3 className="font-semibold">{t("new_focus")}</h3>
                <p>
                  {proposal.subjectName}
                  {proposal.topicName ? ` · ${proposal.topicName}` : ""}
                </p>
              </div>
            ) : null}
            {proposal.recentTrend[0] ? (
              <Link
                onClick={() =>
                  trackAnalysisAction({
                    action: "plan",
                    focusSource: proposal.source,
                    cycleState: "signal",
                  })
                }
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
                className={styles.cyclePrimaryAction}
              >
                {t(cycle ? "add_new_focus" : "add_to_plan")}
              </Link>
            ) : (
              <Link href={{ pathname: "/analysis", query: { tab: "entry" } }}>
                {t("first_exam")}
              </Link>
            )}
          </div>
        ) : null}
        {!baselineMockExamId && !cycle && !proposal ? (
          <Link
            href={{ pathname: "/analysis", query: { tab: "entry" } }}
            className="flex min-h-11 items-center rounded-[var(--radius-card)] px-4 text-sm font-bold focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
          >
            {t("first_exam")}
          </Link>
        ) : null}
        {cycle ? (
          <Link href="/plan" className={styles.cycleTertiaryAction}>
            {t("open_plan")}
          </Link>
        ) : null}
        <Link
          onClick={() => track("notebook")}
          href={{
            pathname: "/notebook",
            query: {
              panel: "index",
              examId,
              subjectRef: focus.subjectRef,
              ...(focus.topicRef && { topicRef: focus.topicRef }),
            },
          }}
          className={styles.cycleTertiaryAction}
        >
          {t("review")}
        </Link>
        {baselineMockExamId ? (
          <Link
            onClick={() => track("coach")}
            href={buildAnalysisCoachHref(coachSeed, baselineMockExamId)}
            className={styles.cycleSecondaryAction}
          >
            {t("coach")}
          </Link>
        ) : null}
      </div>
    </Surface>
  );
}
