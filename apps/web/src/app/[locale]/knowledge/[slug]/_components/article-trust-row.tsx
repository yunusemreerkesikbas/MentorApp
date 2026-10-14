import { ShieldCheckIcon } from "@solar-icons/react/linear/shield-check";
import { getTranslations } from "next-intl/server";
import type { InfoArticleDto } from "@mentor/types";
import type { ArticleAnalyticsParams } from "@/lib/analytics";
import { ArticleSourceLink } from "./article-client-islands";

/**
 * Provenance first (guardrail §4 #1, PRODUCT principle 4): source and last check sit under the title,
 * between two hairlines. No tinted block (2026-10-14): the green shield is the only colour.
 */
export async function ArticleTrustRow({
  article,
  analyticsParams,
  verifiedLabel,
  updatedLabel,
}: {
  article: InfoArticleDto;
  analyticsParams: ArticleAnalyticsParams;
  verifiedLabel: string;
  updatedLabel: string;
}) {
  const t = await getTranslations("article");
  return (
    <div className="mt-6 flex items-start gap-3 border-y border-[var(--play-line)] py-4">
      <ShieldCheckIcon
        size={20}
        strokeWidth={1.75}
        className="mt-0.5 shrink-0 text-[var(--color-success)]"
      />
      <div className="min-w-0">
        <p className="text-body-sm font-extrabold text-[var(--color-main)]">{t("trust_badge")}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-caption font-bold text-[var(--color-secondary)]">
          <span>{t("source_label")}</span>
          <ArticleSourceLink
            source={article.source}
            sourceUrl={article.sourceUrl}
            analyticsParams={analyticsParams}
          />
          <span aria-hidden>·</span>
          <span>{t("last_verified", { date: verifiedLabel })}</span>
          <span aria-hidden>·</span>
          <span>{t("updated_at", { date: updatedLabel })}</span>
        </p>
        <p className="mt-1 text-caption font-semibold text-[var(--color-secondary)]">
          {t("trust_body")}
        </p>
      </div>
    </div>
  );
}
