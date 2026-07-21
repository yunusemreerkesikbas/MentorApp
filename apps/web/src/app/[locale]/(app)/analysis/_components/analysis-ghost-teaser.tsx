"use client";

import { useTranslations } from "next-intl";
import { Card } from "@mentor/ui";

export function AnalysisGhostTeaser() {
  const t = useTranslations("analysis");

  return (
    <Card>
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <span
          className="rounded-[var(--radius-card)] px-4 py-2 text-sm font-bold"
          style={{
            backgroundColor: "color-mix(in srgb, var(--color-chip) 30%, transparent)",
            color: "var(--color-chip-text)",
          }}
        >
          {t("ghost_teaser_title")}
        </span>
        <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
          {t("ghost_teaser_desc")}
        </p>
      </div>
    </Card>
  );
}
