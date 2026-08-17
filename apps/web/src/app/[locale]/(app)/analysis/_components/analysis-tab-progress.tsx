"use client";

import { TrendingDown, TrendingUp } from "lucide-react";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { CoachingAnalysisDto } from "@mentor/types";
import { Card, Chip, SectionHeading } from "@mentor/ui";
import { Link } from "@/i18n/navigation";
import { EmptyState } from "@/components/empty-state";
import { InfoTooltip } from "@/components/info-tooltip";
import { StatLineChart } from "@/components/stat-line-chart";
import { AnalysisGhostTeaser } from "./analysis-ghost-teaser";
import { AnalysisNextFocusCard } from "./analysis-next-focus-card";
import {
  formatTrendDate,
  sliceTrend,
  trendForSparkline,
  type TrendWindow,
} from "./analysis-types";

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
  const chartData = useMemo(
    () =>
      sparkPoints.length > 0
        ? [
            {
              id: t("trend_title"),
              data: sparkPoints.map((point) => ({
                x: formatTrendDate(point.takenAt, locale),
                y: Number(point.totalNet),
              })),
            },
          ]
        : null,
    [sparkPoints, locale, t],
  );
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
                className="flex min-h-11 items-center justify-center rounded-[var(--radius-card)] px-5 py-3 text-sm font-bold text-[var(--color-btn-label)] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none"
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
          <div
            className={
              ghost
                ? "grid gap-6"
                : "grid items-start gap-6 lg:grid-cols-2"
            }
          >
            <Card className="min-w-0">
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <SectionHeading subtitle={t("trend_subtitle")}>
                    {t("trend_title")}
                  </SectionHeading>

                  <div
                    className="flex shrink-0 gap-2"
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
                              ? "color-mix(in srgb, var(--color-chip) 25%, var(--color-surface))"
                              : "color-mix(in srgb, var(--color-main) 4%, transparent)",
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
                </div>

                {sparkPoints.length === 1 ? (
                  <p
                    className="text-center text-sm"
                    style={{ color: "var(--color-secondary)" }}
                  >
                    {t("trend_first")}: {sparkPoints[0]!.totalNet}
                  </p>
                ) : chartData ? (
                  <StatLineChart
                    data={chartData}
                    ariaLabel={t("trend_title")}
                    height={220}
                    valueSuffix=" net"
                  />
                ) : null}
              </div>
            </Card>

            {ghost ? null : <AnalysisGhostTeaser />}
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
                      className="flex flex-col gap-2.5 rounded-[var(--radius-card)] border p-4"
                      style={{
                        background: isFocus
                          ? "color-mix(in srgb, var(--color-chip) 18%, var(--color-surface))"
                          : "var(--color-surface)",
                        borderColor: isFocus
                          ? "transparent"
                          : "color-mix(in srgb, var(--color-main) 8%, transparent)",
                      }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-1">
                          <span
                            className="truncate text-sm font-semibold"
                            style={{ color: "var(--color-secondary)" }}
                          >
                            {subject.subjectName}
                          </span>
                          <InfoTooltip
                            text={
                              subject.normalizedAveragePercent != null
                                ? t("subject_tile_info_full", {
                                    count: subject.attemptCount,
                                    percent: subject.normalizedAveragePercent,
                                  })
                                : t("subject_tile_info_basic", {
                                    count: subject.attemptCount,
                                  })
                            }
                          />
                        </span>
                        {isFocus ? (
                          <Chip size="sm" className="shrink-0">
                            {t("subject_focus_badge")}
                          </Chip>
                        ) : null}
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className="text-2xl font-bold leading-none tabular-nums"
                          style={{
                            color: "var(--color-main)",
                            fontFamily: "var(--font-heading)",
                          }}
                        >
                          {subject.averageNet}
                        </span>
                        {trendUp || trendDown ? (
                          <span
                            className="inline-flex w-fit items-center gap-0.5 text-xs font-semibold tabular-nums"
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
                            {deltaDisplay}
                          </span>
                        ) : null}
                      </div>
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
