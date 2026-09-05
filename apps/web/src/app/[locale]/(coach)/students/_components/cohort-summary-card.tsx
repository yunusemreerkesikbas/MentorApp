"use client";

import { useLocale, useTranslations } from "next-intl";
import { Card, Chip } from "@mentor/ui";
import { formatRate } from "../../_components/mentorship-format";
import type { CohortSummary } from "./cohort-summary";

/**
 * The group at a glance, above the list that ranks it. Roadmap §9 wants "kim geride, neden, ne
 * yapmalı" to surface on entry; the sorted roster answers the first, these counts the second.
 *
 * Everything here is derived from the roster response the page already holds, so the band costs no
 * request. It renders nothing when the roster is empty: a summary of nobody is noise.
 */
export function CohortSummaryCard({ summary }: { summary: CohortSummary }) {
  const t = useTranslations("mentorship");
  const locale = useLocale();
  if (summary.total === 0) return null;

  const adherence = formatRate(summary.planAdherence, locale);

  return (
    <Card>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="text-sm font-semibold" style={{ color: "var(--color-main)" }}>
            {summary.needsAttention === 0
              ? t("cohort_all_clear")
              : t("cohort_needs_attention", {
                  count: summary.needsAttention,
                  total: summary.total,
                })}
          </p>
          <p className="text-xs" style={{ color: "var(--color-secondary)" }}>
            {/* A mean over 2 of 20 students is a different claim from a mean over 20, so the
                denominator travels with it rather than being rounded away into one number. */}
            {adherence === null
              ? t("cohort_plan_adherence_none")
              : t("cohort_plan_adherence", { rate: adherence, count: summary.planAdherenceOf })}
          </p>
        </div>
        {summary.flagCounts.length > 0 && (
          // Labelled so the breakdown is distinguishable from the student list below it, both
          // to a screen reader landing on two adjacent lists and to anything else that walks them.
          <ul className="flex flex-wrap items-center gap-1.5" aria-label={t("cohort_flags_label")}>
            {summary.flagCounts.map(({ flag, count }) => (
              <li key={flag}>
                {/* `normal-case` for the same reason RiskChip needs it: these are sentences about
                    people, and Chip's default title-casing reads like a typo in Turkish. */}
                <Chip size="sm" className="normal-case">
                  {t(`flag_${flag}`)} · {count}
                </Chip>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
