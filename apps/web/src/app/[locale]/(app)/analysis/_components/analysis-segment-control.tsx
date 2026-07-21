"use client";

import { useTranslations } from "next-intl";
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

  function moveFocus(
    event: React.KeyboardEvent<HTMLButtonElement>,
    tab: AnalysisTab,
  ) {
    const currentIndex = TABS.indexOf(tab);
    let nextIndex: number | null = null;

    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIndex = (currentIndex + 1) % TABS.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIndex = (currentIndex - 1 + TABS.length) % TABS.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = TABS.length - 1;
    }

    if (nextIndex == null) return;
    event.preventDefault();
    const nextTab = TABS[nextIndex]!;
    onChange(nextTab);
    requestAnimationFrame(() => {
      document.getElementById("analysis-tab-" + nextTab)?.focus();
    });
  }

  return (
    <div className="flex gap-2" role="tablist" aria-label={t("label")}>
      {TABS.map((tab) => {
        const active = value === tab;
        return (
          <button
            key={tab}
            type="button"
            role="tab"
            id={"analysis-tab-" + tab}
            aria-selected={active}
            aria-controls={"analysis-panel-" + tab}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(tab)}
            onKeyDown={(event) => moveFocus(event, tab)}
            className="min-h-[44px] flex-1 rounded-[var(--radius-card)] px-3 py-2 text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none"
            style={{
              background: active
                ? "color-mix(in srgb, var(--color-chip) 25%, white)"
                : "rgba(0,0,0,0.04)",
              color: active ? "var(--color-main)" : "var(--color-secondary)",
              fontWeight: active ? 600 : 400,
              fontFamily: "var(--font-heading)",
            }}
          >
            {t(tab)}
          </button>
        );
      })}
    </div>
  );
}
