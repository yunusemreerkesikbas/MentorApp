"use client";

import { useLocale, useTranslations } from "next-intl";
import type { InfoArticleSummaryDto } from "@mentor/types";
import { Link } from "@/i18n/navigation";

export function ArticleCard({ article }: { article: InfoArticleSummaryDto }) {
  const t = useTranslations("knowledge");
  const locale = useLocale();
  const dateLabel = article.publishedAt
    ? new Intl.DateTimeFormat(locale, {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(new Date(article.publishedAt))
    : null;
  const authorName = article.author?.name ?? t("editor_fallback");

  return (
    <Link
      href={{ pathname: "/knowledge/[slug]", params: { slug: article.slug } }}
      className="block overflow-hidden rounded-[var(--radius-card)] bg-[var(--color-surface-elevated)] shadow-[var(--shadow-card)] transition-[box-shadow] hover:shadow-[var(--shadow-card-hover)] focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none"
    >
      <div className="aspect-[16/10] bg-[var(--color-surface-container)]">
        {article.coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element -- editorial thumb with known dimensions
          <img
            src={article.coverImage.url}
            alt={article.coverImage.alt}
            width={article.coverImage.width}
            height={article.coverImage.height}
            className="h-full w-full object-cover"
          />
        ) : null}
      </div>
      <div className="p-4">
        <h3
          className="text-balance text-base font-bold"
          style={{
            color: "var(--color-main)",
            fontFamily: "var(--font-heading)",
          }}
        >
          {article.title}
        </h3>
        <div className="mt-3 flex items-center gap-3">
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
      </div>
    </Link>
  );
}

export function AuthorAvatar({ name }: { name: string }) {
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
