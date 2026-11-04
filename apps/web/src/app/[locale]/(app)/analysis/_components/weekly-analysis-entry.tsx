"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { PANEL_CARD, PANEL_CARD_TITLE, PANEL_TEXT_LINK } from "@/components/panel/panel-styles";

export function WeeklyAnalysisEntry({ examId }: { examId: string }) {
  const t = useTranslations("analysis.report");
  return <section className={PANEL_CARD} aria-labelledby="weekly-analysis-entry-title">
    <h2 id="weekly-analysis-entry-title" className={PANEL_CARD_TITLE}>{t("entry_title")}</h2>
    <p className="mt-2 text-sm leading-relaxed text-[var(--color-secondary)]">{t("entry_detail")}</p>
    <Link href={{ pathname: "/analysis/recap", query: { examId, view: "analysis" } }} className={`${PANEL_TEXT_LINK} mt-2`}>
      {t("entry_cta")}
    </Link>
  </section>;
}
