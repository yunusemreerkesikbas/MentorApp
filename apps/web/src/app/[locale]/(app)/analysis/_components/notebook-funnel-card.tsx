"use client";

import { useTranslations } from "next-intl";
import type { CoachingAnalysisDto } from "@mentor/types";
import { PANEL_CARD, PANEL_CARD_TITLE } from "@/components/panel/panel-styles";
import { ProgressLine } from "@/components/panel/progress-line";

/**
 * The notebook's window drawn as a path instead of four metric tiles (DESIGN.md §1 rule 3): what was
 * saved, reviewed at least once, healed. The due count is not here; it lives on the hero's ledge.
 */
export function NotebookFunnelCard({ analysis }: { analysis: CoachingAnalysisDto }) {
  const t = useTranslations("analysis.mistakes");
  const stats = analysis.notebookStats;
  if (stats.savedCount === 0) return null;

  const rows = [
    { key: "saved", label: t("funnel_saved"), value: stats.savedCount, healed: false },
    { key: "reviewed", label: t("funnel_reviewed"), value: stats.reviewedCount, healed: false },
    { key: "healed", label: t("funnel_healed"), value: stats.healedCount, healed: true },
  ];

  return (
    <section className={`${PANEL_CARD} flex flex-col gap-4`} aria-labelledby="analysis-funnel-title">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="analysis-funnel-title" className={PANEL_CARD_TITLE}>
          {t("funnel_title", { days: stats.windowDays })}
        </h2>
        <span className="text-caption font-bold text-[var(--color-secondary)]">
          {t("funnel_caption")}
        </span>
      </div>
      <ol className="flex flex-col gap-3.5">
        {rows.map((row) => (
          <li key={row.key} className="flex flex-col gap-1.5">
            <span className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-extrabold text-[var(--color-main)]">{row.label}</span>
              <span className="text-body-sm font-black tabular-nums text-[var(--color-main)]">
                {row.value}
              </span>
            </span>
            <ProgressLine
              label={row.label}
              value={row.value}
              max={stats.savedCount}
              complete={row.healed}
            />
          </li>
        ))}
      </ol>
      {stats.healedCount === 0 ? (
        <p className="text-caption text-[var(--color-secondary)]">{t("funnel_healed_none")}</p>
      ) : null}
    </section>
  );
}
