"use client";

import { ChevronLeft, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button, Skeleton } from "@mentor/ui";
import { PANEL_TEXT_LINK } from "@/components/panel/panel-styles";
import { AnalysisSegmentControl } from "./analysis-segment-control";
import type { AnalysisTab, AnalysisViewTab } from "./analysis-types";

/**
 * The page speaking for itself, not a card: title and exam, the two views, and "Deneme ekle" as the
 * outline ledge (the page's filled ledge belongs to the view below). The form replaces the tabs with
 * a way back instead of pretending to be a third view.
 */
export function AnalysisHeader({
  tab,
  examName,
  loading,
  onTab,
  onAddExam,
  onBack,
}: {
  tab: AnalysisTab;
  examName: string | null;
  loading: boolean;
  onTab: (tab: AnalysisViewTab) => void;
  onAddExam: () => void;
  onBack: () => void;
}) {
  const t = useTranslations("analysis");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-display font-extrabold leading-tight tracking-[-0.01em] text-[var(--color-main)]">
            {t("heading")}
          </h1>
          {examName ? (
            <p className="mt-1 truncate text-sm font-bold text-[var(--color-secondary)]">
              {examName}
            </p>
          ) : loading ? (
            <Skeleton className="mt-2 h-4 w-32 rounded-[var(--radius-card)]" />
          ) : null}
        </div>
        {tab === "entry" ? null : (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={onAddExam}
            data-testid="analysis-add-exam"
          >
            <Plus className="size-[18px]" strokeWidth={2.6} aria-hidden />
            {t("tabs.entry")}
          </Button>
        )}
      </div>
      {tab === "entry" ? (
        <button type="button" onClick={onBack} className={`${PANEL_TEXT_LINK} -my-2 self-start`}>
          <ChevronLeft className="size-4" aria-hidden />
          {t("entry_back")}
        </button>
      ) : (
        <div className="w-full sm:max-w-sm">
          <AnalysisSegmentControl value={tab} onChange={onTab} />
        </div>
      )}
    </div>
  );
}
