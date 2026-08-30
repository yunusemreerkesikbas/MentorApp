"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Check, Share2 } from "lucide-react";
import type { InfoArticleSummaryDto } from "@mentor/types";
import { Chip } from "@mentor/ui";
import { Link } from "@/i18n/navigation";
import { infoArticleUrl } from "@/lib/content-api";
import { AuthorAvatar } from "./article-card";

export function FeaturedHero({ article }: { article: InfoArticleSummaryDto }) {
  const t = useTranslations("knowledge");
  const locale = useLocale();
  const [copied, setCopied] = useState(false);

  const dateLabel = article.publishedAt
    ? new Intl.DateTimeFormat(locale, {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(new Date(article.publishedAt))
    : null;

  const authorName = article.author?.name ?? t("editor_fallback");

  async function handleShare(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    const url = infoArticleUrl(article.slug);

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: article.title,
          url,
        });
        return;
      } catch {
        // User cancelled or share dismissed — fallback to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard failed or permission blocked
    }
  }

  return (
    <Link
      href={{ pathname: "/knowledge/[slug]", params: { slug: article.slug } }}
      className="group block overflow-hidden rounded-[var(--radius-card)] bg-[var(--color-surface-elevated)] p-4 shadow-[var(--shadow-card)] transition-[box-shadow] hover:shadow-[var(--shadow-card-hover)] focus-visible:outline-none focus-visible:ring-2 sm:p-5 lg:p-6"
    >
      <div className="flex flex-col gap-5 md:flex-row md:items-center lg:gap-6">
        {/* Sol: Post Görseli */}
        <div className="relative aspect-[16/10] w-full shrink-0 overflow-hidden rounded-xl bg-[var(--color-surface-container)] md:aspect-[4/3] md:w-[42%] lg:aspect-[16/10] lg:w-[45%]">
          {article.coverImage ? (
            // eslint-disable-next-line @next/next/no-img-element -- editorial cover with known dimensions
            <img
              src={article.coverImage.url}
              alt={article.coverImage.alt}
              width={article.coverImage.width}
              height={article.coverImage.height}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : null}
        </div>

        {/* Sağ: Başlık, Short Desc, Yazar, Tarih & Paylaşım */}
        <div className="flex flex-1 flex-col justify-between min-w-0">
          <div>
            <Chip size="sm" className="mb-2.5">
              {t(`categories.${article.category.toLowerCase()}`)}
            </Chip>
            <h2
              className="text-balance text-lg font-bold leading-snug sm:text-xl lg:text-2xl"
              style={{
                color: "var(--color-main)",
                fontFamily: "var(--font-heading)",
              }}
            >
              {article.title}
            </h2>
            {article.metaDescription ? (
              <p
                className="mt-2 text-sm leading-relaxed line-clamp-2 sm:text-base sm:line-clamp-3"
                style={{ color: "var(--color-secondary)" }}
              >
                {article.metaDescription}
              </p>
            ) : null}
          </div>

          <div className="mt-5 flex items-center justify-between gap-4 border-t border-[color:color-mix(in_srgb,var(--color-main)_8%,transparent)] pt-4 md:border-t-0 md:pt-0">
            <div className="flex items-center gap-3 min-w-0">
              <AuthorAvatar name={authorName} />
              <div className="min-w-0">
                <p
                  className="truncate text-sm font-semibold"
                  style={{ color: "var(--color-main)" }}
                >
                  {authorName}
                </p>
                {dateLabel ? (
                  <p className="text-xs" style={{ color: "var(--color-secondary)" }}>
                    {dateLabel}
                  </p>
                ) : null}
              </div>
            </div>

            <button
              type="button"
              onClick={handleShare}
              aria-label={copied ? t("share_copied") : t("share_copy")}
              title={copied ? t("share_copied") : t("share_copy")}
              className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border transition-all hover:opacity-80 focus-visible:outline-none focus-visible:ring-2"
              style={{
                borderColor: "color-mix(in srgb, var(--color-main) 16%, transparent)",
                color: "var(--color-main)",
                backgroundColor: "var(--color-surface)",
              }}
            >
              {copied ? (
                <Check className="h-4 w-4" />
              ) : (
                <Share2 className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      </div>
    </Link>
  );
}
