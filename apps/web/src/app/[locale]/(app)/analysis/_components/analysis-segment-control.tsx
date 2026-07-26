"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { SegmentPillControl } from "@/components/segment-pill-control";
import type { AnalysisTab } from "./analysis-types";

const TABS: AnalysisTab[] = ["entry", "progress", "mistakes"];

interface AnalysisSegmentControlProps {
  value: AnalysisTab;
  onChange: (tab: AnalysisTab) => void;
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
      onChange={(id) => onChange(id as AnalysisTab)}
      ariaLabel={t("label")}
      layoutId="analysis-tab-pill"
      equalWidth
      idPrefix="analysis-tab"
    />
  );
}
