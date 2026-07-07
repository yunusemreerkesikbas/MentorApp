"use client";

import { useTranslations } from "next-intl";
import type { AnalizTab } from "./analiz-types";

const TABS: AnalizTab[] = ["gir", "gelisim", "yanlislar"];

interface AnalizSegmentControlProps {
  value: AnalizTab;
  onChange: (tab: AnalizTab) => void;
}

export function AnalizSegmentControl({ value, onChange }: AnalizSegmentControlProps) {
  const t = useTranslations("analysis.tabs");

  return (
    <div
      className="flex gap-2"
      role="tablist"
      aria-label={t("label")}
    >
      {TABS.map((tab) => {
        const active = value === tab;
        return (
          <button
            key={tab}
            type="button"
            role="tab"
            id={`analiz-tab-${tab}`}
            aria-selected={active}
            aria-controls={`analiz-panel-${tab}`}
            onClick={() => onChange(tab)}
            className="min-h-[44px] flex-1 rounded-[var(--radius-card)] px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none"
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
