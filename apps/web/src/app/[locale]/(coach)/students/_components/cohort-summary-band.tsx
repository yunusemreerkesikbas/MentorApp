"use client";

import { useLocale, useTranslations } from "next-intl";
import { formatRate } from "../../_components/mentorship-format";
import { RISK_FLAG_HUE } from "../../_components/risk-chip";
import { SignalCount } from "../../_components/signal-pill";
import type { CohortSummary } from "./cohort-summary";

/**
 * The group at a glance, above the list that ranks it. Roadmap §9 wants "kim geride, neden, ne
 * yapmalı" to surface on entry; the sorted roster answers the first, these counts the second.
 *
 * No longer a `Card`. Its only content is one sentence and a handful of numbers — a measurement,
 * not an object the coach can act on — and the card frame made it look like a third thing to read
 * between the brief and the roster. A flush strip says the same in a band.
 *
 * Everything here is derived from the roster response the page already holds, so it costs no
 * request. It renders nothing when the roster is empty: a summary of nobody is noise.
 */
export function CohortSummaryBand({ summary }: { summary: CohortSummary }) {
  const t = useTranslations("mentorship");
  const locale = useLocale();
  if (summary.total === 0) return null;

  const adherence = formatRate(summary.planAdherence, locale);

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-2 px-1">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="m-0 text-[15px] font-semibold" style={{ color: "var(--color-main)" }}>
          {summary.needsAttention === 0
            ? t("cohort_all_clear")
            : t("cohort_needs_attention", {
                count: summary.needsAttention,
                total: summary.total,
              })}
          {/* The second half of the sentence: what the coach has already handled. Omitted at
              zero — "0 ilgilenildi" reads as a reproach on a morning nobody has started yet. */}
          {summary.attended > 0 && (
            <span style={{ color: "var(--color-secondary)", fontWeight: 400 }}>
              {" · "}
              {t("cohort_attended", { count: summary.attended })}
            </span>
          )}
        </p>
        {summary.flagCounts.length > 0 && (
          // Labelled so the breakdown is distinguishable from the student list below it, both
          // to a screen reader landing on two adjacent lists and to anything else that walks them.
          <ul
            className="flex flex-wrap items-center gap-x-4 gap-y-2"
            aria-label={t("cohort_flags_label")}
          >
            {summary.flagCounts.map(({ flag, count }) => (
              <li key={flag}>
                <SignalCount hue={RISK_FLAG_HUE[flag]} count={count}>
                  {t(`flag_${flag}`)}
                </SignalCount>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="m-0 text-xs" style={{ color: "var(--color-secondary)" }}>
        {/* A mean over 2 of 20 students is a different claim from a mean over 20, so the
            denominator travels with it rather than being rounded away into one number. */}
        {adherence === null
          ? t("cohort_plan_adherence_none")
          : t("cohort_plan_adherence", { rate: adherence, count: summary.planAdherenceOf })}
      </p>
    </div>
  );
}
