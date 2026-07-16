"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { AnalysisFocusDto } from "@mentor/types";
import { Card, Chip, SectionHeading } from "@mentor/ui";
import { Link } from "@/i18n/navigation";
import { AnalizSparkline } from "./analiz-sparkline";
import { buildAnalysisCoachHref } from "./analiz-types";

interface AnalizNextFocusCardProps {
  focus: AnalysisFocusDto;
}

export function AnalizNextFocusCard({ focus }: AnalizNextFocusCardProps) {
  const t = useTranslations("analysis.focus");
  const sourceLabel =
    focus.source === "PHOTO_SIGNAL" ? t("source_photo") : t("source_average");
  const evidenceLabel =
    focus.evidenceLevel === "EARLY"
      ? t("evidence_level_early")
      : t("evidence_level_repeated");
  const sparkPoints = useMemo(
    () =>
      [...focus.recentTrend].reverse().map((point) => ({
        id: point.mockExamId,
        totalNet: point.net,
      })),
    [focus.recentTrend],
  );
  const coachSeed = focus.topicName
    ? t("coach_seed", {
        subject: focus.subjectName,
        topic: focus.topicName,
      })
    : t("coach_seed_subject", { subject: focus.subjectName });

  return (
    <Card
      className="relative overflow-hidden"
      style={{
        background:
          "linear-gradient(145deg, color-mix(in srgb, var(--color-chip) 16%, white), white 72%)",
      }}
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,0.8fr)] lg:items-center">
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Chip>{evidenceLabel}</Chip>
            <span
              className="text-xs"
              style={{ color: "var(--color-secondary)" }}
            >
              {sourceLabel} · {t("evidence", { count: focus.evidenceCount })}
            </span>
          </div>
          <SectionHeading subtitle={t("subtitle")}>{t("title")}</SectionHeading>
          <div className="flex flex-col gap-1">
            <p
              className="text-2xl font-bold"
              style={{
                color: "var(--color-main)",
                fontFamily: "var(--font-heading)",
              }}
            >
              {focus.subjectName}
            </p>
            {focus.topicName ? (
              <p
                className="text-lg font-semibold"
                style={{ color: "var(--color-body)" }}
              >
                {focus.topicName}
              </p>
            ) : null}
            <p
              className="text-sm leading-6"
              style={{ color: "var(--color-body)" }}
            >
              {focus.message}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Link
              href={{
                pathname: "/plan",
                query: {
                  add: "1",
                  subject: focus.subjectName,
                  title: focus.suggestedTaskTitle,
                },
              }}
              className="flex min-h-11 w-full items-center justify-center rounded-[var(--radius-card)] px-5 py-3 text-sm font-bold text-white transition-opacity duration-200 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none sm:w-fit"
              style={{
                backgroundColor: "var(--color-btn)",
                boxShadow: "var(--shadow-card)",
              }}
            >
              {t("cta")}
            </Link>
            <Link
              href={buildAnalysisCoachHref(coachSeed)}
              className="flex min-h-11 w-full items-center justify-center rounded-[var(--radius-card)] border px-5 py-3 text-sm font-bold transition-opacity duration-200 hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none sm:w-fit"
              style={{
                borderColor: "var(--color-border)",
                backgroundColor: "white",
                color: "var(--color-btn)",
              }}
            >
              {t("coach_cta")}
            </Link>
          </div>
        </div>

        <div
          className="flex min-w-0 flex-col gap-2 rounded-[var(--radius-card)] p-4"
          style={{ background: "rgba(255,255,255,0.58)" }}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p
                className="text-sm font-bold"
                style={{ color: "var(--color-main)" }}
              >
                {t("recent_title")}
              </p>
              <p
                className="text-xs"
                style={{ color: "var(--color-secondary)" }}
              >
                {t("recent_subtitle")}
              </p>
            </div>
            {focus.recentDelta ? (
              <Chip>{t("recent_delta", { delta: focus.recentDelta })}</Chip>
            ) : (
              <Chip>{t("early_signal")}</Chip>
            )}
          </div>
          <AnalizSparkline
            points={sparkPoints}
            label={t("chart_label", { subject: focus.subjectName })}
          />
          <p
            className="text-sm leading-5"
            style={{ color: "var(--color-body)" }}
          >
            {focus.trendMessage}
          </p>
        </div>
      </div>
    </Card>
  );
}
