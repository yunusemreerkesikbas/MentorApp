"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef } from "react";
import type { ExamCalendarDto, InfoArticleDto, InfoArticleSummaryDto } from "@mentor/types";
import { Card } from "@mentor/ui";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth-context";
import { staggerItemVariants } from "@/lib/stagger-motion";
import { ArticleMarkdown } from "./article-markdown";
import { ArticleTrustFooter } from "./article-trust-footer";
import { ArticleGallerySlider } from "./article-gallery-slider";
import { trackArticleEvent } from "@/lib/analytics";
import { ContextualAdSlot } from "@/components/ads/contextual-ad-slot";
import { recordArticleView, infoArticleUrl } from "@/lib/content-api";
import { AuthorAvatar } from "../../../(app)/knowledge/_components/article-card";
import { KnowledgeSidebar } from "../../../(app)/knowledge/_components/knowledge-sidebar";
import {
  KNOWLEDGE_ARTICLE_BODY_CLASS,
  KNOWLEDGE_ARTICLE_SIDEBAR_CLASS,
  KNOWLEDGE_ARTICLE_SPLIT_CLASS,
  KNOWLEDGE_PAGE_CLASS,
} from "../../../(app)/knowledge/_components/knowledge-layout";

/** Client article body — motion + trust chrome + Coach handoff. */
export function ArticleContent({
  article,
  related,
  calendar,
  verifiedLabel,
  publishedLabel,
  updatedLabel,
}: {
  article: InfoArticleDto;
  related: InfoArticleSummaryDto[];
  calendar: ExamCalendarDto | null;
  verifiedLabel: string;
  publishedLabel: string | null;
  updatedLabel: string;
}) {
  const reduceMotion = useReducedMotion();
  const translate = useTranslations("article");
  const knowledge = useTranslations("knowledge");
  const locale = useLocale();
  const readSentinel = useRef<HTMLDivElement>(null);
  const { status } = useAuth();
  const authenticated = status === "authenticated";
  const coachSeed = translate("coach_seed", { title: article.title });
  const authorName = article.author?.name ?? knowledge("editor_fallback");
  const slides = [
    ...(article.coverImage ? [article.coverImage] : []),
    ...article.galleryImages,
  ];
  const analyticsParams = useMemo(
    () => ({
      slug: article.slug,
      exam_family: article.family,
      category: article.category,
      locale,
    }),
    [article.slug, article.family, article.category, locale],
  );

  useEffect(() => {
    const trackView = () => trackArticleEvent("article_view", analyticsParams);
    trackView();
    void recordArticleView(article.slug);
    window.addEventListener("mentor:analytics-consent", trackView);
    return () => window.removeEventListener("mentor:analytics-consent", trackView);
  }, [analyticsParams, article.slug]);

  useEffect(() => {
    const sentinel = readSentinel.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      trackArticleEvent("article_read_complete", analyticsParams);
      observer.disconnect();
    });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [analyticsParams]);

  const headerMotion = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 8 },
        animate: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.3, ease: "easeOut" as const },
        },
      };

  const bodyMotion = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 12 },
        animate: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.35, ease: "easeOut" as const, delay: 0.08 },
        },
      };

  return (
    <motion.article
      className={KNOWLEDGE_PAGE_CLASS}
      variants={reduceMotion ? undefined : staggerItemVariants}
      initial={reduceMotion ? false : "hidden"}
      animate={reduceMotion ? undefined : "show"}
    >
      <div className={KNOWLEDGE_ARTICLE_SPLIT_CLASS}>
        <div className={KNOWLEDGE_ARTICLE_BODY_CLASS}>
          <motion.header className="mb-6" {...headerMotion}>
            <h1
              className="text-balance text-2xl font-bold lg:text-3xl"
              style={{
                color: "var(--color-main)",
                fontFamily: "var(--font-heading)",
              }}
            >
              {article.title}
            </h1>
            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm" style={{ color: "var(--color-secondary)" }}>
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
            {article.metaDescription && (
              <p className="mt-3 text-lg leading-relaxed" style={{ color: "var(--color-secondary)" }}>
                {article.metaDescription}
              </p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs" style={{ color: "var(--color-secondary)" }}>
              {translate("source_label")}{" "}
              <a
                href={article.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackArticleEvent("article_source_click", analyticsParams)}
                className="inline-flex min-h-11 items-center font-semibold underline underline-offset-2 transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2"
                style={{ color: "var(--color-secondary)" }}
              >
                {article.source} ↗
              </a>
              <span>{translate("last_verified", { date: verifiedLabel })}</span>
              <span>{translate("updated_at", { date: updatedLabel })}</span>
            </div>
          </motion.header>

          {slides.length > 0 ? (
            <div className="mb-6">
              <ArticleGallerySlider images={slides} />
            </div>
          ) : null}

          <motion.div {...bodyMotion}>
            <Card solid>
              <ArticleMarkdown body={article.body} format={article.bodyFormat} />
            </Card>
            <ArticleTrustFooter />
            <div ref={readSentinel} aria-hidden />
            <ContextualAdSlot
              contentSlug={article.slug}
              examType={article.family as import("@mentor/types").ExamType}
            />
            <Card className="mt-4">
              <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2
                    className="text-lg font-bold"
                    style={{
                      color: "var(--color-main)",
                      fontFamily: "var(--font-heading)",
                    }}
                  >
                    {translate("coach_title")}
                  </h2>
                  <p className="mt-1 text-sm" style={{ color: "var(--color-secondary)" }}>
                    {translate("coach_body")}
                  </p>
                </div>
                <Link
                  href={
                    authenticated
                      ? {
                          pathname: "/coach/chat",
                          query: {
                            seed: coachSeed,
                            contextArticleSlug: article.slug,
                          },
                        }
                      : "/login"
                  }
                  className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-[var(--radius-card)] px-5 py-2 text-sm font-bold text-[var(--color-btn-label)] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2"
                  style={{
                    backgroundColor: "var(--color-btn)",
                    fontFamily: "var(--font-heading)",
                  }}
                  onClick={() => trackArticleEvent("article_coach_cta_click", analyticsParams)}
                >
                  {translate(authenticated ? "coach_cta" : "coach_sign_in_cta")}
                </Link>
              </div>
            </Card>
          </motion.div>
        </div>

        <div className={KNOWLEDGE_ARTICLE_SIDEBAR_CLASS}>
          <KnowledgeSidebar
            calendar={calendar}
            related={related}
            share={{ title: article.title, url: infoArticleUrl(article.slug) }}
          />
        </div>
      </div>
    </motion.article>
  );
}
