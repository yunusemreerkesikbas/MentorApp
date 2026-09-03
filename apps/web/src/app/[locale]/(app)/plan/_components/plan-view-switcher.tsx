"use client";

import type { CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { SlidingTabs } from "@mentor/ui";
import type { PlanViewMode } from "./plan-utils";

const MODES: PlanViewMode[] = ["list", "timeline", "calendar"];

export function PlanViewSwitcher({
  value,
  onChange,
}: {
  value: PlanViewMode;
  onChange: (mode: PlanViewMode) => void;
}) {
  const t = useTranslations("plan");

  const style = {
    ["--tabs-pill-bg" as string]: "var(--color-main)",
    ["--tabs-text-active" as string]: "var(--color-btn-label)",
    backgroundColor:
      "color-mix(in srgb, var(--color-surface-container) 80%, transparent)",
  } as CSSProperties;

  return (
    <SlidingTabs
      equalWidth
      className="w-full border border-[color-mix(in_srgb,var(--color-border)_70%,transparent)]"
      style={style}
      ariaLabel={t("view_switch_aria")}
      value={value}
      onChange={(id) => onChange(id as PlanViewMode)}
      items={MODES.map((mode) => ({
        id: mode,
        label: t(`view_${mode}`),
      }))}
    />
  );
}
