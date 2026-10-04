"use client";

import dynamic from "next/dynamic";
import { ArrowDownRight, ArrowUpRight, Star } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { CoachingAnalysisDto } from "@mentor/types";
import { Skeleton } from "@mentor/ui";
import { PANEL_CARD, PANEL_CARD_TITLE } from "@/components/panel/panel-styles";
import { formatShortDate, trendForSparkline } from "./analysis-types";

// Nivo is the heaviest thing on the page and the chart sits below the fold on phones.
const StatLineChart = dynamic(
  () => import("@/components/stat-line-chart").then((mod) => mod.StatLineChart),
  {
    ssr: false,
    loading: () => <Skeleton className="h-52 rounded-[var(--radius-card)]" />,
  },
);

/**
 * "Net seyrin": the latest net, how it moved against the exam before, the record, and the line
 * across the last attempts. Downward moves are grey, never red (DESIGN.md §2.4).
 */
export function NetTrendCard({ analysis }: { analysis: CoachingAnalysisDto }) {
  const t = useTranslations("analysis.net_card");
  const tSummary = useTranslations("analysis.summary");
  const locale = useLocale();
  const latest = analysis.trend[0];
  if (!latest) return null;

  const ghost = analysis.ghost;
  const delta = ghost ? Number(ghost.previousDelta) : 0;
  const points = trendForSparkline(analysis.trend);
  const labels = new Map(points.map((point) => [point.id, formatShortDate(point.takenAt, locale)]));
  const record = analysis.personalRecordNet;

  return (
    <section className={`${PANEL_CARD} flex flex-col gap-3`} aria-labelledby="analysis-net-title">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="analysis-net-title" className={PANEL_CARD_TITLE}>
          {t("title")}
        </h2>
        <span className="text-caption font-bold tabular-nums text-[var(--color-secondary)]">
          {t("count", { count: analysis.trend.length })}
        </span>
      </div>

      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <span
            data-testid="analysis-latest-net"
            aria-label={tSummary("last_net", { net: latest.totalNet })}
            className="text-display font-black leading-none tabular-nums text-[var(--color-main)]"
          >
            {latest.totalNet}
          </span>
          <span aria-hidden className="text-body-sm font-extrabold text-[var(--color-secondary)]">
            {t("unit")}
          </span>
          {ghost ? (
            <>
              <span
                data-testid="analysis-net-delta"
                aria-label={tSummary("delta", { delta: ghost.previousDelta })}
                className={`inline-flex items-center gap-0.5 text-body-sm font-extrabold tabular-nums ${delta > 0 ? "text-[var(--color-success)]" : "text-[var(--color-secondary)]"}`}
              >
                {delta > 0 ? (
                  <ArrowUpRight className="size-4" strokeWidth={2.6} aria-hidden />
                ) : delta < 0 ? (
                  <ArrowDownRight className="size-4" strokeWidth={2.6} aria-hidden />
                ) : null}
                {ghost.previousDelta}
              </span>
              <span className="text-caption text-[var(--color-secondary)]">
                {t("delta_caption")}
              </span>
            </>
          ) : null}
        </div>
        {ghost ? (
          ghost.isNewRecord ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--color-streak-core)_30%,var(--color-surface))] px-2.5 py-1 text-xs font-extrabold text-[var(--color-main)]">
              <Star className="size-3.5 fill-current text-[var(--color-star)]" aria-hidden />
              {t("new_record")}
            </span>
          ) : record ? (
            <span className="text-caption font-bold text-[var(--color-secondary)]">
              {t.rich("record", {
                value: record,
                b: (chunks) => (
                  <strong className="font-extrabold tabular-nums text-[var(--color-main)]">
                    {chunks}
                  </strong>
                ),
              })}
            </span>
          ) : null
        ) : null}
      </div>

      {points.length > 1 ? (
        <StatLineChart
          data={[
            {
              id: t("title"),
              data: points.map((point) => ({ x: point.id, y: Number(point.totalNet) })),
            },
          ]}
          ariaLabel={t("chart_label", { count: points.length })}
          height={208}
          valueSuffix={` ${t("unit")}`}
          formatX={(id) => labels.get(id) ?? id}
          marker={record ? { value: Number(record), label: t("record_marker") } : undefined}
          tableCaption={t("table_caption")}
        />
      ) : (
        <p className="text-body-sm font-semibold text-[var(--color-secondary)]">{t("first")}</p>
      )}
    </section>
  );
}
