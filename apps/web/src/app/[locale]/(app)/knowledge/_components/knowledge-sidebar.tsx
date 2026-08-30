"use client";

import { useLocale, useTranslations } from "next-intl";
import type { ExamCalendarDto, InfoArticleSummaryDto } from "@mentor/types";
import { Link } from "@/i18n/navigation";
import {
  ARTICLE_CATEGORIES,
  type ArticleCategory,
} from "@/lib/content-api";
import { CountdownRail } from "./countdown-rail";
import { ShareRow } from "./share-row";

const chipBorder = "color-mix(in srgb, var(--color-main) 16%, transparent)";

export function KnowledgeSidebar({
  calendar,
  related,
  selectedCategory,
  onSelectCategory,
  share,
}: {
  calendar: ExamCalendarDto | null;
  related: InfoArticleSummaryDto[];
  selectedCategory?: ArticleCategory | null;
  onSelectCategory?: (category: ArticleCategory | null) => void;
  share?: { title: string; url: string };
}) {
  const t = useTranslations("knowledge");
  const locale = useLocale();

  return (
    <aside className="flex min-w-0 flex-col gap-8">
      <CountdownRail calendar={calendar} />

      <section>
        <h2
          className="text-sm font-bold"
          style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
        >
          {t("recommended_topics")}
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {ARTICLE_CATEGORIES.map((category) => {
            const selected = selectedCategory === category;
            const className =
              "min-h-11 rounded-full border px-4 text-sm font-medium";
            const style = {
              borderColor: chipBorder,
              backgroundColor: selected
                ? "var(--color-surface-container)"
                : "var(--color-surface)",
              color: "var(--color-main)",
            };
            if (!onSelectCategory) {
              return (
                <span key={category} className={`${className} inline-flex items-center`} style={style}>
                  {t(`categories.${category.toLowerCase()}`)}
                </span>
              );
            }
            return (
              <button
                key={category}
                type="button"
                onClick={() => onSelectCategory(selected ? null : category)}
                className={`${className} cursor-pointer transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2`}
                style={style}
              >
                {t(`categories.${category.toLowerCase()}`)}
              </button>
            );
          })}
        </div>
      </section>

      {related.length > 0 ? (
        <section>
          <h2
            className="text-sm font-bold"
            style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
          >
            {t("related_posts")}
          </h2>
          <ul className="mt-3 flex flex-col gap-4">
            {related.map((article) => (
              <li key={article.slug}>
                <Link
                  href={{
                    pathname: "/knowledge/[slug]",
                    params: { slug: article.slug },
                  }}
                  className="flex items-start justify-between gap-3 rounded-[var(--radius-card)] focus-visible:outline-none focus-visible:ring-2"
                >
                  <div className="min-w-0">
                    <p
                      className="text-xs"
                      style={{ color: "var(--color-secondary)" }}
                    >
                      {t(`categories.${article.category.toLowerCase()}`)}
                    </p>
                    <p
                      className="mt-1 text-balance text-sm font-bold"
                      style={{
                        color: "var(--color-main)",
                        fontFamily: "var(--font-heading)",
                      }}
                    >
                      {article.title}
                    </p>
                    {article.publishedAt ? (
                      <p
                        className="mt-1 text-xs"
                        style={{ color: "var(--color-secondary)" }}
                      >
                        {new Intl.DateTimeFormat(locale, {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        }).format(new Date(article.publishedAt))}
                      </p>
                    ) : null}
                  </div>
                  {article.coverImage ? (
                    // eslint-disable-next-line @next/next/no-img-element -- editorial thumb
                    <img
                      src={article.coverImage.url}
                      alt={article.coverImage.alt}
                      width={72}
                      height={72}
                      className="h-[72px] w-[72px] shrink-0 rounded-[var(--radius-card)] object-cover"
                    />
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {share ? <ShareRow title={share.title} url={share.url} /> : null}
    </aside>
  );
}
