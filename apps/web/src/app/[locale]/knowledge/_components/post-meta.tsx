import { getTranslations } from "next-intl/server";
import type { InfoArticleSummaryDto } from "@mentor/types";

export function formatPostDate(iso: string, locale: string, month: "short" | "long" = "short") {
  return new Intl.DateTimeFormat(locale, { day: "numeric", month, year: "numeric" }).format(
    new Date(iso),
  );
}

/** "Başvuru · 1 Haz 2026": the category is the only colour in a row's text. */
export async function PostMeta({ article, locale }: { article: InfoArticleSummaryDto; locale: string }) {
  const t = await getTranslations("knowledge");
  return (
    <p className="flex flex-wrap items-center gap-x-1.5 text-caption font-bold text-[var(--color-secondary)]">
      <span className="font-extrabold text-[var(--play-selected-ink)]">
        {t(`categories.${article.category.toLowerCase()}`)}
      </span>
      {article.publishedAt ? (
        <>
          <span aria-hidden>·</span>
          <time dateTime={article.publishedAt}>{formatPostDate(article.publishedAt, locale)}</time>
        </>
      ) : null}
    </p>
  );
}
