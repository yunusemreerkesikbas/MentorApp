"use client";

/* eslint-disable @next/next/no-img-element -- validated editorial dimensions + storage URL */

import { motion, useReducedMotion } from "framer-motion";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef } from "react";
import type { InfoArticleDto } from "@mentor/types";
import { Card } from "@mentor/ui";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth-context";
import { staggerItemVariants } from "@/lib/stagger-motion";
import { ArticleBackNav } from "./article-back-nav";
import { ArticleMarkdown } from "./article-markdown";
import { ArticleTrustFooter } from "./article-trust-footer";
import { trackArticleEvent } from "@/lib/analytics";

/** Client article body — motion + trust chrome + Coach handoff. */
export function ArticleContent({
  article,
  verifiedLabel,
  publishedLabel,
  updatedLabel,
}: {
  article: InfoArticleDto;
  verifiedLabel: string;
  publishedLabel: string | null;
  updatedLabel: string;
}) {
  const reduceMotion = useReducedMotion();
  const translate = useTranslations("article");
  const locale = useLocale();
  const readSentinel = useRef<HTMLDivElement>(null);
  const { status } = useAuth();
  const authenticated = status === "authenticated";
  const coachSeed = translate("coach_seed", { title: article.title });
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
    window.addEventListener("mentor:analytics-consent", trackView);
    return () => window.removeEventListener("mentor:analytics-consent", trackView);
  }, [analyticsParams]);

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
      className="mx-auto max-w-3xl px-5 py-8 lg:px-8 lg:py-10"
      variants={reduceMotion ? undefined : staggerItemVariants}
      initial={reduceMotion ? false : "hidden"}
      animate={reduceMotion ? undefined : "show"}
    >
      <ArticleBackNav />

      <motion.header className="mb-6" {...headerMotion}>
        {article.coverImage && (
          <img
            src={article.coverImage.url}
            alt={article.coverImage.alt}
            width={article.coverImage.width}
            height={article.coverImage.height}
            className="mb-6 h-auto w-full rounded-[var(--radius-card)] object-cover"
          />
        )}
        <h1
          className="text-2xl font-bold lg:text-3xl"
          style={{
            color: "var(--color-main)",
            fontFamily: "var(--font-heading)",
          }}
        >
          {article.title}
        </h1>
        {article.metaDescription && (
          <p className="mt-3 text-lg leading-relaxed" style={{ color: "var(--color-secondary)" }}>
            {article.metaDescription}
          </p>
        )}
        {article.author && (
          <div className="mt-4 text-sm" style={{ color: "var(--color-secondary)" }}>
            <span className="font-semibold" style={{ color: "var(--color-main)" }}>
              {translate("author_byline", { name: article.author.name })}
            </span>
            {article.author.title && <span> · {article.author.title}</span>}
            {article.author.bio && <p className="mt-1">{article.author.bio}</p>}
          </div>
        )}
        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs" style={{ color: "var(--color-secondary)" }}>
          {publishedLabel && <span>{translate("published_at", { date: publishedLabel })}</span>}
          <span>{translate("updated_at", { date: updatedLabel })}</span>
        </div>
        <div
          className="mt-3 flex flex-wrap items-center gap-2 text-xs"
          style={{ color: "var(--color-secondary)" }}
        >
          {translate("source_label")}{" "}
          <a
            href={article.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackArticleEvent("article_source_click", analyticsParams)}
            className="inline-flex min-h-11 items-center font-semibold underline underline-offset-2 transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none"
            style={{ color: "var(--color-secondary)" }}
          >
            {article.source} ↗
          </a>
          <span>{translate("last_verified", { date: verifiedLabel })}</span>
        </div>
      </motion.header>

      <motion.div {...bodyMotion}>
        <Card solid>
          <ArticleMarkdown body={article.body} format={article.bodyFormat} />
        </Card>
        <ArticleTrustFooter />
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
              <p
                className="mt-1 text-sm"
                style={{ color: "var(--color-secondary)" }}
              >
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
              className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-[var(--radius-card)] px-5 py-2 text-sm font-bold text-[var(--color-btn-label)] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none"
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
        <div ref={readSentinel} aria-hidden="true" />
      </motion.div>
    </motion.article>
  );
}
