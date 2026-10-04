import { ChevronRight, ShieldCheck } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { InfoArticleSummaryDto } from "@mentor/types";
import { PANEL_CARD } from "@/components/panel/panel-styles";
import { Link } from "@/i18n/navigation";
import { ArticleCover } from "./article-cover";
import { PostMeta } from "./post-meta";

/** The whole card is the link, so nothing interactive lives inside it (the old share button did). */
export async function FeaturedPost({
  article,
  locale,
}: {
  article: InfoArticleSummaryDto;
  locale: string;
}) {
  const t = await getTranslations("knowledge");
  return (
    <Link
      href={{ pathname: "/knowledge/[slug]", params: { slug: article.slug } }}
      className={`${PANEL_CARD} group flex flex-col gap-4 transition-shadow duration-200 hover:shadow-[var(--shadow-card-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none sm:flex-row sm:gap-6`}
    >
      <ArticleCover
        article={article}
        priority
        className="aspect-video w-full sm:aspect-4/3 sm:w-5/12 sm:max-w-80"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-2.5">
        <PostMeta article={article} locale={locale} />
        <h2 className="text-balance text-xl font-extrabold leading-snug text-[var(--color-main)] sm:text-title">
          {article.title}
        </h2>
        {article.metaDescription ? (
          <p className="line-clamp-3 text-body-sm font-semibold text-[var(--color-body)]">
            {article.metaDescription}
          </p>
        ) : null}
        <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-1">
          <p className="flex items-center gap-1.5 text-caption font-bold text-[var(--color-secondary)]">
            <ShieldCheck className="size-4 text-[var(--color-success)]" aria-hidden />
            {t("verified_source", { source: article.source })}
          </p>
          <span className="inline-flex min-h-11 items-center gap-1 text-sm font-extrabold text-[var(--play-selected-ink)] underline-offset-4 group-hover:underline">
            {t("read_post")}
            <ChevronRight className="size-4" aria-hidden />
          </span>
        </div>
      </div>
    </Link>
  );
}
