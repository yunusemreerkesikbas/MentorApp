import { ChevronRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import type { ExamType, InfoArticleDto, InfoArticleSummaryDto } from "@mentor/types";
import { ContextualAdSlot } from "@/components/ads/contextual-ad-slot";
import { PANEL_GRID_CLASS, PANEL_MAIN_CLASS } from "@/components/panel/panel-styles";
import { Link } from "@/i18n/navigation";
import type { ArticleAnalyticsParams } from "@/lib/analytics";
import { blogHref } from "@/lib/blog-url";
import { infoArticleUrl, type ArticleCategory } from "@/lib/content-api";
import { ExamDaySkeleton } from "../../_components/blog-skeletons";
import { ExamDayCard } from "../../_components/exam-day-card";
import { ArticleViewTracker } from "./article-client-islands";
import { ArticleCoachCard } from "./article-coach-card";
import { ArticleGallerySlider } from "./article-gallery-slider";
import { ArticleMarkdown } from "./article-markdown";
import { ArticleTrustRow } from "./article-trust-row";
import { RelatedPosts } from "./related-posts";
import { ShareRow } from "./share-row";

const CRUMB =
  "inline-flex min-h-11 items-center text-[var(--play-selected-ink)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]";

/**
 * A blog post in the panel frame: reading column on the left (breadcrumb → title → provenance →
 * body → Puhu's one action), the exam card, related posts and share on the right at ≥1280.
 */
export async function ArticleContent({
  article,
  related,
  locale,
  verifiedLabel,
  publishedLabel,
  updatedLabel,
  readingMinutes,
}: {
  article: InfoArticleDto;
  related: InfoArticleSummaryDto[];
  locale: string;
  verifiedLabel: string;
  publishedLabel: string | null;
  updatedLabel: string;
  readingMinutes: number;
}) {
  const [t, k] = await Promise.all([getTranslations("article"), getTranslations("knowledge")]);
  const family = article.family as ExamType;
  const category = article.category as ArticleCategory;
  const slides = [...(article.coverImage ? [article.coverImage] : []), ...article.galleryImages];
  const analyticsParams: ArticleAnalyticsParams = {
    slug: article.slug,
    exam_family: article.family,
    category: article.category,
    locale,
  };

  return (
    <main className={PANEL_MAIN_CLASS}>
      <div className={PANEL_GRID_CLASS}>
        <article className="flex min-w-0 max-w-2xl flex-col">
          <nav
            aria-label={t("breadcrumb_label")}
            className="flex items-center gap-1 text-caption font-extrabold text-[var(--color-secondary)]"
          >
            <Link href={blogHref({ family })} className={CRUMB}>
              {t("blog")}
            </Link>
            <ChevronRight className="size-3.5" aria-hidden />
            <Link href={blogHref({ family, category })} className={CRUMB}>
              {k(`categories.${category.toLowerCase()}`)}
            </Link>
          </nav>
          <header className="flex flex-col gap-3">
            <h1 className="text-balance text-display font-extrabold leading-tight tracking-[-0.01em] text-[var(--color-main)]">
              {article.title}
            </h1>
            {article.metaDescription ? (
              <p className="text-pretty text-base font-semibold leading-relaxed text-[var(--color-body)] sm:text-lg">
                {article.metaDescription}
              </p>
            ) : null}
            <p className="flex flex-wrap items-center gap-x-1.5 text-caption font-bold text-[var(--color-secondary)]">
              <span>{article.author?.name ?? k("editor_fallback")}</span>
              {publishedLabel ? (
                <>
                  <span aria-hidden>·</span>
                  <time dateTime={article.publishedAt ?? undefined}>{publishedLabel}</time>
                </>
              ) : null}
              <span aria-hidden>·</span>
              <span>{t("reading_time", { minutes: readingMinutes })}</span>
            </p>
          </header>
          <ArticleTrustRow
            article={article}
            analyticsParams={analyticsParams}
            verifiedLabel={verifiedLabel}
            updatedLabel={updatedLabel}
          />
          {slides.length > 0 ? (
            <div className="mt-6">
              <ArticleGallerySlider images={slides} />
            </div>
          ) : null}
          <div className="mt-8">
            <ArticleMarkdown body={article.body} format={article.bodyFormat} />
          </div>
          <ArticleViewTracker articleSlug={article.slug} analyticsParams={analyticsParams} />
          <ContextualAdSlot contentSlug={article.slug} examType={family} />
          <ArticleCoachCard
            articleSlug={article.slug}
            title={article.title}
            analyticsParams={analyticsParams}
          />
        </article>
        <aside
          aria-label={t("aside_label")}
          className="flex min-w-0 flex-col gap-5 xl:sticky xl:top-6"
        >
          <Suspense fallback={<ExamDaySkeleton />}>
            <ExamDayCard family={family} locale={locale} />
          </Suspense>
          {related.length > 0 ? <RelatedPosts related={related} locale={locale} /> : null}
          <ShareRow title={article.title} url={infoArticleUrl(article.slug)} />
        </aside>
      </div>
    </main>
  );
}
