"use client";

import { useTranslations } from "next-intl";
import type { AnalysisFocusDto } from "@mentor/types";
import { Card, Chip, SectionHeading } from "@mentor/ui";
import { Link } from "@/i18n/navigation";

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

  return (
    <Card
      className="relative flex h-full flex-col gap-4 overflow-hidden"
      style={{
        background:
          "linear-gradient(145deg, color-mix(in srgb, var(--color-chip) 16%, white), white 72%)",
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Chip>{evidenceLabel}</Chip>
        <span className="text-xs" style={{ color: "var(--color-secondary)" }}>
          {sourceLabel} · {t("evidence", { count: focus.evidenceCount })}
        </span>
      </div>
      <SectionHeading subtitle={t("subtitle")}>{t("title")}</SectionHeading>
      <div className="flex flex-col gap-1">
        <p
          className="text-xl font-bold"
          style={{
            color: "var(--color-main)",
            fontFamily: "var(--font-heading)",
          }}
        >
          {focus.subjectName}
        </p>
        <p className="text-sm leading-6" style={{ color: "var(--color-body)" }}>
          {focus.message}
        </p>
      </div>
      <Link
        href={{
          pathname: "/plan",
          query: {
            add: "1",
            subject: focus.subjectName,
            title: focus.suggestedTaskTitle,
          },
        }}
        className="mt-auto flex min-h-11 w-full items-center justify-center rounded-[var(--radius-card)] px-5 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none"
        style={{
          backgroundColor: "var(--color-btn)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        {t("cta")}
      </Link>
    </Card>
  );
}
