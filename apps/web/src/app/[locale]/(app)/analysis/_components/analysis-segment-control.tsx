"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { SegmentPillControl } from "@/components/segment-pill-control";
import type { AnalysisViewTab } from "./analysis-types";

const TABS: AnalysisViewTab[] = ["progress", "mistakes"];

interface AnalysisSegmentControlProps {
  value: AnalysisViewTab;
  onChange: (tab: AnalysisViewTab) => void;
}

export function AnalysisSegmentControl({
  value,
  onChange,
}: AnalysisSegmentControlProps) {
  const t = useTranslations("analysis.tabs");

  const items = useMemo(
    () =>
      TABS.map((tab) => ({
        id: tab,
        label: t(tab),
        panelId: `analysis-panel-${tab}`,
      })),
    [t],
  );

  return (
    <SegmentPillControl
      items={items}
      value={value}
      onChange={(id) => onChange(id as AnalysisViewTab)}
      ariaLabel={t("label")}
      className="[&_.t-tab]:px-3 sm:[&_.t-tab]:px-4"
      equalWidth
      idPrefix="analysis-tab"
    />
  );
}
