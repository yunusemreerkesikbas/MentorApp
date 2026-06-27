"use client";

import { useTranslations } from "next-intl";
import type { PlanViewMode } from "./plan-utils";

const MODES: PlanViewMode[] = ["list", "timeline", "week"];

export function PlanViewSwitcher({
  value,
  onChange,
}: {
  value: PlanViewMode;
  onChange: (mode: PlanViewMode) => void;
}) {
  const t = useTranslations("plan");

  return (
    <div
      role="tablist"
      aria-label={t("view_switch_aria")}
      className="flex w-full rounded-[12px] border border-white/40 p-1"
      style={{
        backgroundColor: "color-mix(in srgb, var(--color-surface-container, #f0edec) 80%, transparent)",
      }}
    >
      {MODES.map((mode) => {
        const active = value === mode;
        return (
          <button
            key={mode}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(mode)}
            className="min-h-10 flex-1 rounded-[10px] px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none"
            style={{
              fontFamily: "var(--font-heading)",
              backgroundColor: active ? "var(--color-main)" : "transparent",
              color: active ? "#fff" : "var(--color-secondary)",
              boxShadow: active ? "var(--shadow-card)" : undefined,
            }}
          >
            {t(`view_${mode}`)}
          </button>
        );
      })}
    </div>
  );
}
