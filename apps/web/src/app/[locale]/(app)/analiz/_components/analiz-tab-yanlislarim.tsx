"use client";

import { useTranslations } from "next-intl";
import type { CoachingAnalysisDto, PhotoAccessDto } from "@mentor/types";
import { Card, ProgressBar, SectionHeading } from "@mentor/ui";
import { FormError } from "@/components/form";
import { PhotoCategorizeCard } from "./photo-categorize-card";

interface AnalizTabYanlislarimProps {
  activeMockExamId: string | null;
  photoAccess: PhotoAccessDto | null;
  photoAccessError: string | null;
  analysis: CoachingAnalysisDto | null;
  onCategorized: () => void;
}

export function AnalizTabYanlislarim({
  activeMockExamId,
  photoAccess,
  photoAccessError,
  analysis,
  onCategorized,
}: AnalizTabYanlislarimProps) {
  const t = useTranslations("analysis");

  const signals = analysis?.photoSubjectSignals ?? [];
  const maxCount = signals.reduce((m, s) => Math.max(m, s.count), 0);

  return (
    <div className="flex flex-col gap-6">
      {!activeMockExamId ? (
        <Card>
          <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
            {t("empty_trend_desc")}
          </p>
        </Card>
      ) : photoAccessError ? (
        <Card className="flex flex-col gap-3">
          <SectionHeading as="h2" subtitle={t("photo_unavailable")}>
            {t("photo_section_title")}
          </SectionHeading>
          <FormError message={photoAccessError} />
        </Card>
      ) : photoAccess ? (
        <PhotoCategorizeCard
          mockExamId={activeMockExamId}
          access={photoAccess}
          onCategorized={onCategorized}
        />
      ) : null}

      {signals.length > 0 ? (
        <Card>
          <SectionHeading subtitle={t("photo_signals_subtitle")}>
            {t("photo_signals_title")}
          </SectionHeading>
          <ul className="mt-4 flex flex-col gap-3">
            {signals.map((signal) => (
              <li key={signal.subjectRef} className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-sm">
                  <span style={{ color: "var(--color-body)" }}>
                    {signal.subjectName}
                  </span>
                  <span
                    className="tabular-nums"
                    style={{ color: "var(--color-secondary)" }}
                  >
                    {t("photo_count", { count: signal.count })}
                  </span>
                </div>
                <ProgressBar
                  value={
                    maxCount > 0
                      ? Math.round((signal.count / maxCount) * 100)
                      : 0
                  }
                />
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <Card>
          <SectionHeading subtitle={t("photo_signals_empty_desc")}>
            {t("photo_signals_title")}
          </SectionHeading>
        </Card>
      )}
    </div>
  );
}

