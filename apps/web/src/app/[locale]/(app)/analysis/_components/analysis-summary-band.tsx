"use client";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

import { useLocale, useTranslations } from "next-intl";
import type { CoachingAnalysisDto } from "@mentor/types";
import { Card } from "@mentor/ui";
import { StatLineChart } from "@/components/stat-line-chart";
import { formatTrendDate, trendForSparkline } from "./analysis-types";

/** Sparkline window — last N attempts (newest-first from API, then reversed for L→R). */
const SPARKLINE_WINDOW = 6;

interface AnalysisSummaryBandProps {
  analysis: CoachingAnalysisDto | null;
}

type TrendTone = "up" | "down" | "neutral";

function toneFromDelta(delta: string | null | undefined): TrendTone {
  if (delta == null) return "neutral";
  const value = Number(delta);
  if (!Number.isFinite(value) || value === 0) return "neutral";
  return value > 0 ? "up" : "down";
}

/**
 * KPI-style metric banner — large net, minimal inline delta, sparkline from recent attempts.
 */
export function AnalysisSummaryBand({ analysis }: AnalysisSummaryBandProps) {
  const t = useTranslations("analysis.summary");
  const tTrend = useTranslations("analysis");
  const tGhost = useTranslations("ghost");
  const locale = useLocale();

  const latest = analysis?.trend[0] ?? null;
  const ghost = analysis?.ghost ?? null;
  const sparkPoints = analysis
    ? trendForSparkline(analysis.trend.slice(0, SPARKLINE_WINDOW))
    : [];
  const tone = toneFromDelta(ghost?.previousDelta);
  // Downward analytics use `secondary`, never `danger` (DESIGN.md §2.4) — anti-shame guardrail.
  const toneColor =
    tone === "up" ? "var(--color-success)" : "var(--color-secondary)";
  const chartData =
    sparkPoints.length > 0
      ? [
          {
            id: tTrend("trend_title"),
            data: sparkPoints.map((point) => ({
              x: formatTrendDate(point.takenAt, locale),
              y: Number(point.totalNet),
            })),
          },
        ]
      : null;

  // No attempts yet — the Gir tab's own empty state already teaches this; don't repeat it here.
  if (!latest) {
    return null;
  }

  return (
    <Card className="overflow-hidden" data-testid="analysis-metric-banner">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
        <div className="flex min-w-0 flex-col gap-1.5">
          <span
            className="text-xs font-semibold tracking-wide uppercase"
            style={{
              color: "var(--color-secondary)",
              fontFamily: "var(--font-body)",
            }}
          >
            {t("label")}
          </span>

          <div className="flex flex-wrap items-baseline gap-2.5">
            <p
              className="text-3xl font-bold tabular-nums leading-none sm:text-4xl"
              style={{
                color: "var(--color-main)",
                fontFamily: "var(--font-heading)",
              }}
              data-testid="analysis-latest-net"
              aria-label={t("last_net", { net: latest.totalNet })}
            >
              {latest.totalNet}
            </p>

            {ghost ? (
              <span
                className="inline-flex items-center gap-0.5 text-sm font-semibold tabular-nums"
                style={{ color: toneColor, fontFamily: "var(--font-heading)" }}
                data-testid="analysis-net-delta"
                aria-label={t("delta", { delta: ghost.previousDelta })}
              >
                {tone === "up" ? (
                  <ArrowUpRight
                    className="size-3.5 shrink-0"
                    strokeWidth={2.5}
                    aria-hidden
                  />
                ) : null}
                {tone === "down" ? (
                  <ArrowDownRight
                    className="size-3.5 shrink-0"
                    strokeWidth={2.5}
                    aria-hidden
                  />
                ) : null}
                {ghost.previousDelta}
              </span>
            ) : null}
          </div>

          {ghost?.headline ? (
            <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
              {ghost.headline}
            </p>
          ) : (
            <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
              {t("caption")}
            </p>
          )}

          {ghost ? (
            <p className="text-xs" style={{ color: "var(--color-secondary)" }}>
              {ghost.isNewRecord
                ? tGhost("new_record")
                : tGhost("record_delta", { delta: ghost.recordDelta })}
            </p>
          ) : null}
        </div>

        {chartData ? (
          <div className="min-w-0 w-full sm:max-w-[240px] lg:max-w-[280px] sm:shrink-0">
            <StatLineChart
              data={chartData}
              ariaLabel={tTrend("trend_title")}
              height={76}
              color={toneColor}
              valueSuffix=" net"
              compact
            />
          </div>
        ) : null}
      </div>
    </Card>
  );
}
