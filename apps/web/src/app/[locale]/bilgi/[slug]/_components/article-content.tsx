"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import type { InfoArticleDto } from "@mentor/types";
import { Card } from "@mentor/ui";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth-context";
import { staggerItemVariants } from "@/lib/stagger-motion";
import { ArticleBackNav } from "./article-back-nav";
import { ArticleMarkdown } from "./article-markdown";
import { ArticleTrustFooter } from "./article-trust-footer";

/** Client article body — motion + trust chrome + Coach handoff. */
export function ArticleContent({
  article,
  verifiedLabel,
}: {
  article: InfoArticleDto;
  verifiedLabel: string;
}) {
  const reduceMotion = useReducedMotion();
  const translate = useTranslations("article");
  const { status } = useAuth();
  const authenticated = status === "authenticated";
  const coachSeed = translate("coach_seed", { title: article.title });

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
        <h1
          className="text-2xl font-bold lg:text-3xl"
          style={{
            color: "var(--color-main)",
            fontFamily: "var(--font-heading)",
          }}
        >
          {article.title}
        </h1>
        <div
          className="mt-3 flex flex-wrap items-center gap-2 text-xs"
          style={{ color: "var(--color-secondary)" }}
        >
          {translate("source_label")}{" "}
          <a
            href={article.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
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
          <ArticleMarkdown body={article.body} />
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
                  ? `/koc/chat?seed=${encodeURIComponent(coachSeed)}`
                  : "/giris"
              }
              className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-[var(--radius-card)] px-5 py-2 text-sm font-bold text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none"
              style={{
                backgroundColor: "var(--color-btn)",
                fontFamily: "var(--font-heading)",
              }}
            >
              {translate(authenticated ? "coach_cta" : "coach_sign_in_cta")}
            </Link>
          </div>
        </Card>
      </motion.div>
    </motion.article>
  );
}
