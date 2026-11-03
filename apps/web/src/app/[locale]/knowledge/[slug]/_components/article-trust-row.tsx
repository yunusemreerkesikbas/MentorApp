import { ShieldCheckIcon } from "@solar-icons/react/linear/shield-check";
import { getTranslations } from "next-intl/server";
import type { InfoArticleDto } from "@mentor/types";
import type { ArticleAnalyticsParams } from "@/lib/analytics";
import { ArticleMarkdown } from "./article-markdown";
import { ArticleSourceLink } from "./article-client-islands";

/**
 * One provenance section after the article: retain scope, page citations and verification dates.
 */
export async function ArticleTrustRow({
  scope,
  citation,
  article,
  analyticsParams,
  verifiedLabel,
  updatedLabel,
}: {
  scope: string | null;
  citation: string | null;
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
          {!citation ? <span>{t("source_label")}</span> : null}
          {!citation ? <ArticleSourceLink
            source={article.source}
            sourceUrl={article.sourceUrl}
            analyticsParams={analyticsParams}
          /> : null}
          {!citation ? <span aria-hidden>·</span> : null}
          <span>{t("last_verified", { date: verifiedLabel })}</span>
          <span aria-hidden>·</span>
          <span>{t("updated_at", { date: updatedLabel })}</span>
        </p>
        {scope ? <p className="mt-3 text-body-sm text-[var(--color-body)]">{scope}</p> : null}
        {citation ? <ArticleMarkdown body={citation} format="MARKDOWN" /> : null}
      </div>
    </div>
  );
}
