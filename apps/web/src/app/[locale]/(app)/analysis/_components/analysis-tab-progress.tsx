"use client";

import { TrendingDown, TrendingUp } from "lucide-react";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { CoachingAnalysisDto } from "@mentor/types";
import { Card, Chip, SectionHeading } from "@mentor/ui";
import { Link } from "@/i18n/navigation";
import { EmptyState } from "@/components/empty-state";
import { InfoTooltip } from "@/components/info-tooltip";
import { AnalysisGhostTeaser } from "./analysis-ghost-teaser";
import { AnalysisHeroBackdrop } from "./analysis-hero-backdrop";
import { AnalysisNextFocusCard } from "./analysis-next-focus-card";
import { AnalysisSparkline } from "./analysis-sparkline";
import {
  formatTrendDate,
  sliceTrend,
  trendForSparkline,
  type TrendWindow,
} from "./analysis-types";
import { GhostCard } from "./ghost-card";

interface AnalysisTabProgressProps {
  analysis: CoachingAnalysisDto | null;
}

export function AnalysisTabProgress({ analysis }: AnalysisTabProgressProps) {
  const t = useTranslations("analysis");
  const locale = useLocale();
  const [window, setWindow] = useState<TrendWindow>("12");

  const trend = useMemo(() => analysis?.trend ?? [], [analysis]);
  const sliced = useMemo(() => sliceTrend(trend, window), [trend, window]);
  const sparkPoints = useMemo(() => trendForSparkline(sliced), [sliced]);
  const ghost = analysis?.ghost ?? null;

  if (!analysis || trend.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <Card>
          <EmptyState
            title={t("empty_trend_chip")}
            description={t("empty_trend_desc")}
            puhuVariant="encouraging"
            action={
              <Link
                href={{ pathname: "/analysis", query: { tab: "entry" } }}
                className="flex min-h-11 items-center justify-center rounded-[var(--radius-card)] px-5 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none"
                style={{ backgroundColor: "var(--color-btn)" }}
              >
                {t("summary.new_entry")}
              </Link>
            }
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {analysis.nextFocus ? (
        <AnalysisNextFocusCard focus={analysis.nextFocus} />
      ) : null}

      <section aria-labelledby="analysis-evidence-heading">
        <div className="flex items-center gap-1">
          <h3
            id="analysis-evidence-heading"
            className="text-xl leading-tight font-semibold"
            style={{
              color: "var(--color-main)",
              fontFamily: "var(--font-heading)",
            }}
          >
            {t("evidence_title")}
          </h3>
          <InfoTooltip text={t("evidence_subtitle")} />
        </div>

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
              <SectionHeading>{t("subject_avg_title")}</SectionHeading>
              <div
                className="mt-4 grid gap-3"
                style={{
                  gridTemplateColumns: "repeat(auto-fit, minmax(9.5rem, 1fr))",
                }}
              >
                {analysis.subjects.map((subject) => {
                  const isFocus =
                    analysis.nextFocus?.subjectRef === subject.subjectRef;
                  const delta =
                    subject.netDelta != null ? Number(subject.netDelta) : 0;
                  const trendUp = delta > 0.005;
                  const trendDown = delta < -0.005;
                  const deltaDisplay =
                    trendUp && subject.netDelta != null
                      ? `+${subject.netDelta}`
                      : subject.netDelta;
                  return (
                    <div
                      key={subject.subjectRef}
                      className="flex flex-col gap-2 rounded-[var(--radius-card)] p-3"
                      style={{
                        background: isFocus
                          ? "color-mix(in srgb, var(--color-chip) 18%, white)"
                          : "rgba(0,0,0,0.03)",
                      }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span
                          className="min-w-0 truncate text-sm font-semibold"
                          style={{ color: "var(--color-secondary)" }}
                        >
                          {subject.subjectName}
                        </span>
                        {isFocus ? (
                          <Chip size="sm" className="shrink-0">
                            {t("subject_focus_badge")}
                          </Chip>
                        ) : null}
                      </div>

                      <span
                        className="text-2xl font-bold leading-none tabular-nums"
                        style={{
                          color: "var(--color-main)",
                          fontFamily: "var(--font-heading)",
                        }}
                      >
                        {subject.averageNet}
                      </span>

                      <div className="flex items-center justify-between gap-2">
                        <span
                          className="text-xs"
                          style={{ color: "var(--color-secondary)" }}
                        >
                          {t("avg_count", { count: subject.attemptCount })}
                        </span>
                        {subject.normalizedAveragePercent != null ? (
                          <span
                            className="text-xs font-semibold tabular-nums"
                            style={{ color: "var(--color-chip-text)" }}
                          >
                            {t("avg_normalized", {
                              percent: subject.normalizedAveragePercent,
                            })}
                          </span>
                        ) : null}
                      </div>

                      {trendUp || trendDown ? (
                        <div
                          className="flex items-center gap-1 text-xs font-semibold tabular-nums"
                          style={{
                            color: trendUp
                              ? "var(--color-success)"
                              : "var(--color-secondary)",
                          }}
                        >
                          {trendUp ? (
                            <TrendingUp
                              className="size-3.5 shrink-0"
                              strokeWidth={2.25}
                              aria-hidden
                            />
                          ) : (
                            <TrendingDown
                              className="size-3.5 shrink-0"
                              strokeWidth={2.25}
                              aria-hidden
                            />
                          )}
                          {t("subject_trend_delta", { delta: deltaDisplay })}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </Card>
          ) : null}
        </div>
      </section>
    </div>
  );
}
