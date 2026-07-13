"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { CoachingAnalysisDto, WeeklyReviewDto } from "@mentor/types";
import { Button, Card, SectionHeading } from "@mentor/ui";
import { Link } from "@/i18n/navigation";
import { AnalizGhostTeaser } from "./analiz-ghost-teaser";
import { AnalizHeroBackdrop } from "./analiz-hero-backdrop";
import { AnalizNextFocusCard } from "./analiz-next-focus-card";
import { AnalizSparkline } from "./analiz-sparkline";
import {
  formatTrendDate,
  sliceTrend,
  trendForSparkline,
  type TrendWindow,
} from "./analiz-types";
import { GhostCard } from "./ghost-card";
import {
  AnalizWeeklyReviewCard,
  AnalizWeeklyReviewSkeleton,
} from "./analiz-weekly-review-card";

type DevelopmentExtrasState =
  | { status: "idle"; examId: string | null }
  | { status: "loading"; examId: string }
  | {
      status: "ready";
      examId: string;
      data: { weeklyReview: WeeklyReviewDto; premium: boolean };
    }
  | { status: "error"; examId: string; message: string };

interface AnalizTabGelisimProps {
  examId: string;
  analysis: CoachingAnalysisDto | null;
  extras: DevelopmentExtrasState;
  onRetryExtras: () => void;
}

export function AnalizTabGelisim({
  examId,
  analysis,
  extras,
  onRetryExtras,
}: AnalizTabGelisimProps) {
  const t = useTranslations("analysis");
  const locale = useLocale();
  const [window, setWindow] = useState<TrendWindow>("12");

  const trend = useMemo(() => analysis?.trend ?? [], [analysis]);
  const sliced = useMemo(() => sliceTrend(trend, window), [trend, window]);
  const sparkPoints = useMemo(() => trendForSparkline(sliced), [sliced]);
  const ghost = analysis?.ghost ?? null;
  const coachSeed = encodeURIComponent(t("coach_seed"));
  const premium =
    extras.status === "ready" ? extras.data.premium : undefined;

  const weeklyReview = (
    <WeeklyReviewSlot
      examId={examId}
      extras={extras}
      onRetry={onRetryExtras}
    />
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
        <AnalizNextFocusCard focus={analysis.nextFocus} />
      ) : null}

      {weeklyReview}

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Card className="relative min-w-0 overflow-hidden">
          <AnalizHeroBackdrop />
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

            <AnalizSparkline points={sparkPoints} label={t("trend_title")} />

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

        {ghost ? (
          <GhostCard examId={examId} ghost={ghost} premium={premium} />
        ) : (
          <AnalizGhostTeaser />
        )}
      </div>

      {analysis.subjects.length > 0 ? (
        <Card>
          <details>
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 rounded-[var(--radius-card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]">
              <span className="flex flex-col gap-1">
                <span
                  className="font-bold"
                  style={{
                    color: "var(--color-main)",
                    fontFamily: "var(--font-heading)",
                  }}
                >
                  {t("subject_avg_title")}
                </span>
                <span
                  className="text-sm"
                  style={{ color: "var(--color-secondary)" }}
                >
                  {t("subject_avg_scope")}
                </span>
              </span>
              <span aria-hidden="true" style={{ color: "var(--color-secondary)" }}>
                ↓
              </span>
            </summary>

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
          </details>
        </Card>
      ) : null}

      <Link
        href={`/koc/chat?seed=${coachSeed}`}
        className="flex min-h-[44px] w-full items-center justify-center rounded-[var(--radius-card)] px-6 py-3 text-base font-bold transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none"
        style={{
          backgroundColor: "var(--color-btn)",
          color: "white",
          boxShadow: "var(--shadow-card)",
          fontFamily: "var(--font-body)",
        }}
      >
        {t("coach_cta")}
      </Link>
    </div>
  );
}

function WeeklyReviewSlot({
  examId,
  extras,
  onRetry,
}: {
  examId: string;
  extras: DevelopmentExtrasState;
  onRetry: () => void;
}) {
  const t = useTranslations("analysis.weekly");

  if (extras.status === "ready") {
    return (
      <AnalizWeeklyReviewCard
        examId={examId}
        review={extras.data.weeklyReview}
        premium={extras.data.premium}
      />
    );
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

  return <AnalizWeeklyReviewSkeleton />;
}

