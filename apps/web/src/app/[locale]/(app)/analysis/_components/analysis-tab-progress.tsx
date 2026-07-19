"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { CoachingAnalysisDto, WeeklyReviewDto } from "@mentor/types";
import { Button, Card, SectionHeading } from "@mentor/ui";
import { AnalysisGhostTeaser } from "./analysis-ghost-teaser";
import { AnalysisHeroBackdrop } from "./analysis-hero-backdrop";
import { AnalysisNextFocusCard } from "./analysis-next-focus-card";
import { AnalysisSparkline } from "./analysis-sparkline";
import {
  formatTrendDate,
  shouldOpenAnalysisEvidence,
  sliceTrend,
  trendForSparkline,
  type TrendWindow,
} from "./analysis-types";
import { GhostCard } from "./ghost-card";
import {
  AnalysisWeeklyReviewCard,
  AnalysisWeeklyReviewSkeleton,
} from "./analysis-weekly-review-card";

type DevelopmentExtrasState =
  | { status: "idle"; examId: string | null }
  | { status: "loading"; examId: string }
  | { status: "ready"; examId: string; data: WeeklyReviewDto }
  | { status: "error"; examId: string; message: string };

interface AnalysisTabGelisimProps {
  analysis: CoachingAnalysisDto | null;
  extras: DevelopmentExtrasState;
  onRetryExtras: () => void;
}

export function AnalysisTabGelisim({
  analysis,
  extras,
  onRetryExtras,
}: AnalysisTabGelisimProps) {
  const t = useTranslations("analysis");
  const locale = useLocale();
  const [window, setWindow] = useState<TrendWindow>("12");

  const trend = useMemo(() => analysis?.trend ?? [], [analysis]);
  const sliced = useMemo(() => sliceTrend(trend, window), [trend, window]);
  const sparkPoints = useMemo(() => trendForSparkline(sliced), [sliced]);
  const ghost = analysis?.ghost ?? null;

  const weeklyReview = (
    <WeeklyReviewSlot extras={extras} onRetry={onRetryExtras} />
  );

  if (!analysis || trend.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        {weeklyReview}
        <Card>
          <div className="mt-4 flex flex-col items-center gap-4 py-6 text-center">
            <span
              className="rounded-[var(--radius-card)] px-4 py-2 text-sm font-bold"
              style={{
                backgroundColor:
                  "color-mix(in srgb, var(--color-chip) 30%, transparent)",
                color: "var(--color-chip-text)",
              }}
            >
              {t("empty_trend_chip")}
            </span>
            <p
              className="text-base"
              style={{ color: "var(--color-secondary)" }}
            >
              {t("empty_trend_desc")}
            </p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {analysis.nextFocus ? (
        <AnalysisNextFocusCard focus={analysis.nextFocus} />
      ) : null}

      {weeklyReview}

      <details
        open={shouldOpenAnalysisEvidence(analysis.nextFocus != null)}
        className="rounded-[var(--radius-card)] border p-4 sm:p-5"
        style={{
          borderColor: "color-mix(in srgb, var(--color-main) 10%, transparent)",
          background: "var(--color-surface-container)",
        }}
      >
        <summary className="min-h-11 cursor-pointer rounded-[var(--radius-card)] py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]">
          <span className="ml-2 inline-flex flex-col gap-1 align-middle">
            <span
              className="font-bold"
              style={{
                color: "var(--color-main)",
                fontFamily: "var(--font-heading)",
              }}
            >
              {t("evidence_title")}
            </span>
            <span
              className="text-sm font-normal"
              style={{ color: "var(--color-secondary)" }}
            >
              {t("evidence_subtitle")}
            </span>
          </span>
        </summary>

        <div className="mt-4 flex flex-col gap-6">
          <div className="grid items-start gap-6 lg:grid-cols-2">
            <Card className="relative min-w-0 overflow-hidden">
              <AnalysisHeroBackdrop />
              <div className="relative z-10 flex flex-col gap-4">
                <SectionHeading subtitle={t("trend_subtitle")}>
                  {t("trend_title")}
                </SectionHeading>

                <div
                  className="flex gap-2"
                  role="group"
                  aria-label={t("time_filter.label")}
                >
                  {(["4", "8", "12"] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={window === value}
                      onClick={() => setWindow(value)}
                      className="min-h-11 cursor-pointer rounded-[var(--radius-card)] px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
                      style={{
                        background:
                          window === value
                            ? "color-mix(in srgb, var(--color-chip) 25%, white)"
                            : "rgba(0,0,0,0.04)",
                        color:
                          window === value
                            ? "var(--color-main)"
                            : "var(--color-secondary)",
                      }}
                    >
                      {t(
                        `time_filter.${
                          value === "4"
                            ? "last4"
                            : value === "8"
                              ? "last8"
                              : "last12"
                        }`,
                      )}
                    </button>
                  ))}
                </div>

                {sparkPoints.length === 1 ? (
                  <p
                    className="text-center text-sm"
                    style={{ color: "var(--color-secondary)" }}
                  >
                    {t("trend_first")}: {sparkPoints[0]!.totalNet}
                  </p>
                ) : null}

                <AnalysisSparkline
                  points={sparkPoints}
                  label={t("trend_title")}
                />

                <ul
                  className="flex flex-col gap-2 border-t pt-3"
                  style={{
                    borderColor:
                      "color-mix(in srgb, var(--color-main) 8%, transparent)",
                  }}
                >
                  {sliced.map((point) => (
                    <li key={point.id} className="flex justify-between text-sm">
                      <span style={{ color: "var(--color-body)" }}>
                        {formatTrendDate(point.takenAt, locale)}
                      </span>
                      <span
                        className="font-bold tabular-nums"
                        style={{
                          color: "var(--color-main)",
                          fontFamily: "var(--font-heading)",
                        }}
                      >
                        {point.totalNet}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </Card>

            {ghost ? <GhostCard ghost={ghost} /> : <AnalysisGhostTeaser />}
          </div>

          {analysis.subjects.length > 0 ? (
            <Card>
              <SectionHeading subtitle={t("subject_avg_scope")}>
                {t("subject_avg_title")}
              </SectionHeading>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {analysis.subjects.map((subject) => {
                  const isFocus =
                    analysis.nextFocus?.subjectRef === subject.subjectRef;
                  return (
                    <div
                      key={subject.subjectRef}
                      className="flex flex-col gap-1 rounded-[var(--radius-card)] p-3"
                      style={{
                        background: isFocus
                          ? "color-mix(in srgb, var(--color-chip) 18%, white)"
                          : "rgba(0,0,0,0.03)",
                      }}
                    >
                      <span
                        className="text-sm font-semibold"
                        style={{ color: "var(--color-main)" }}
                      >
                        {subject.subjectName}
                      </span>
                      <span
                        className="text-lg font-bold tabular-nums"
                        style={{ color: "var(--color-main)" }}
                      >
                        {subject.averageNet}
                      </span>
                      <span
                        className="text-xs"
                        style={{ color: "var(--color-secondary)" }}
                      >
                        {t("avg_template", {
                          avg: subject.averageNet,
                          count: subject.attemptCount,
                        })}
                      </span>
                      {subject.normalizedAveragePercent != null &&
                      subject.questionCount != null ? (
                        <span
                          className="text-xs font-semibold tabular-nums"
                          style={{ color: "var(--color-chip-text)" }}
                        >
                          {t("avg_normalized", {
                            percent: subject.normalizedAveragePercent,
                            questions: subject.questionCount,
                          })}
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </Card>
          ) : null}
        </div>
      </details>
    </div>
  );
}

function WeeklyReviewSlot({
  extras,
  onRetry,
}: {
  extras: DevelopmentExtrasState;
  onRetry: () => void;
}) {
  const t = useTranslations("analysis.weekly");

  if (extras.status === "ready") {
    return <AnalysisWeeklyReviewCard review={extras.data} />;
  }

  if (extras.status === "error") {
    return (
      <Card className="flex flex-col items-start gap-3">
        <SectionHeading>{t("title")}</SectionHeading>
        <p
          role="status"
          className="text-sm"
          style={{ color: "var(--color-secondary)" }}
        >
          {t("load_error")}
        </p>
        <Button type="button" variant="secondary" onClick={onRetry}>
          {t("retry")}
        </Button>
      </Card>
    );
  }

  return <AnalysisWeeklyReviewSkeleton />;
}
