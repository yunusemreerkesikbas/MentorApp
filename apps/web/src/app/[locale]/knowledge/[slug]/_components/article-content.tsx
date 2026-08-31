import { getTranslations } from "next-intl/server";
import type { ExamCalendarDto, InfoArticleDto, InfoArticleSummaryDto } from "@mentor/types";
import { Card } from "@mentor/ui";
import { ContextualAdSlot } from "@/components/ads/contextual-ad-slot";
import type { ArticleAnalyticsParams } from "@/lib/analytics";
import {
  KNOWLEDGE_ARTICLE_BODY_CLASS,
  KNOWLEDGE_ARTICLE_SIDEBAR_CLASS,
  KNOWLEDGE_ARTICLE_SPLIT_CLASS,
  KNOWLEDGE_PAGE_CLASS,
} from "../../../(app)/knowledge/_components/knowledge-layout";
import { ArticleGallerySlider } from "./article-gallery-slider";
import {
  ArticleCoachCta,
  ArticleSourceLink,
  ArticleViewTracker,
} from "./article-client-islands";
import { ArticleMarkdown } from "./article-markdown";
import { PublicArticleSidebar } from "./public-article-sidebar";
import { ArticleTrustFooter } from "./article-trust-footer";

export async function ArticleContent({
  article,
  related,
  calendar,
  locale,
  verifiedLabel,
  publishedLabel,
  updatedLabel,
}: {
  article: InfoArticleDto;
  related: InfoArticleSummaryDto[];
  calendar: ExamCalendarDto | null;
  locale: string;
  verifiedLabel: string;
  publishedLabel: string | null;
  updatedLabel: string;
}) {
  const [translate, knowledge] = await Promise.all([
    getTranslations("article"),
    getTranslations("knowledge"),
  ]);
  const coachSeed = translate("coach_seed", { title: article.title });
  const authorName = article.author?.name ?? knowledge("editor_fallback");
  const slides = [
    ...(article.coverImage ? [article.coverImage] : []),
    ...article.galleryImages,
  ];
  const analyticsParams: ArticleAnalyticsParams = {
    slug: article.slug,
    exam_family: article.family,
    category: article.category,
    locale,
  };

  return (
    <article className={KNOWLEDGE_PAGE_CLASS}>
      <div className={KNOWLEDGE_ARTICLE_SPLIT_CLASS}>
        <div className={KNOWLEDGE_ARTICLE_BODY_CLASS}>
          <header className="mb-6">
            <h1
              className="text-balance text-2xl font-bold lg:text-3xl"
              style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
            >
              {article.title}
            </h1>
            <div
              className="mt-4 flex flex-wrap items-center gap-3 text-sm"
              style={{ color: "var(--color-secondary)" }}
            >
              <AuthorAvatar name={authorName} />
              <span className="font-semibold" style={{ color: "var(--color-main)" }}>
                {authorName}
              </span>
              <span>·</span>
              <span>{knowledge(`categories.${article.category.toLowerCase()}`)}</span>
              {publishedLabel ? (
                <>
                  <span>·</span>
                  <span>{publishedLabel}</span>
                </>
              ) : null}
            </div>
            {article.metaDescription ? (
              <p
                className="mt-3 text-lg leading-relaxed"
                style={{ color: "var(--color-secondary)" }}
              >
                {article.metaDescription}
              </p>
            ) : null}
            <div
              className="mt-3 flex flex-wrap items-center gap-2 text-xs"
              style={{ color: "var(--color-secondary)" }}
            >
              {translate("source_label")} {" "}
              <ArticleSourceLink
                source={article.source}
                sourceUrl={article.sourceUrl}
                analyticsParams={analyticsParams}
              />
              <span>{translate("last_verified", { date: verifiedLabel })}</span>
              <span>{translate("updated_at", { date: updatedLabel })}</span>
            </div>
          </header>

          {slides.length > 0 ? (
            <div className="mb-6">
              <ArticleGallerySlider images={slides} />
            </div>
          ) : null}

          <Card solid>
            <ArticleMarkdown body={article.body} format={article.bodyFormat} />
          </Card>
          <ArticleTrustFooter />
          <ArticleViewTracker articleSlug={article.slug} analyticsParams={analyticsParams} />
          <ContextualAdSlot
            contentSlug={article.slug}
            examType={article.family as import("@mentor/types").ExamType}
          />
          <Card className="mt-4">
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2
                  className="text-lg font-bold"
                  style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
                >
                  {translate("coach_title")}
                </h2>
                <p className="mt-1 text-sm" style={{ color: "var(--color-secondary)" }}>
                  {translate("coach_body")}
                </p>
              </div>
              <ArticleCoachCta
                articleSlug={article.slug}
                coachSeed={coachSeed}
                authenticatedLabel={translate("coach_cta")}
                anonymousLabel={translate("coach_sign_in_cta")}
                analyticsParams={analyticsParams}
              />
            </div>
          </Card>
        </div>

        <div className={KNOWLEDGE_ARTICLE_SIDEBAR_CLASS}>
          <PublicArticleSidebar
            calendar={calendar}
            related={related}
            locale={locale}
            share={{ title: article.title, slug: article.slug }}
          />
        </div>
      </div>
    </article>
  );
}

function AuthorAvatar({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <span
      aria-hidden="true"
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold"
      style={{
        backgroundColor: "var(--color-surface-container)",
        color: "var(--color-main)",
        fontFamily: "var(--font-heading)",
      }}
    >
      {initials || "M"}
    </span>
  );
}
