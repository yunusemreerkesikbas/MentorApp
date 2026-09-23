import { ChevronRight } from "lucide-react";
import type { InfoArticleSummaryDto } from "@mentor/types";
import { Link } from "@/i18n/navigation";
import { ArticleCover } from "./article-cover";
import { PostMeta } from "./post-meta";

/** DESIGN §6.1 list rows: one card, hairlines between rows, the whole row is the link. */
export function PostRows({
  articles,
  locale,
}: {
  articles: InfoArticleSummaryDto[];
  locale: string;
}) {
  return (
    <ul className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-1 shadow-[var(--shadow-card)]">
      {articles.map((article) => (
        <li key={article.slug} className="border-t border-[var(--color-border)] first:border-t-0">
          <Link
            href={{ pathname: "/knowledge/[slug]", params: { slug: article.slug } }}
            className="group flex items-center gap-3 rounded-[var(--radius-card)] py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] sm:gap-4 sm:py-4"
          >
            <ArticleCover
              article={article}
              className="size-18 sm:h-18 sm:w-24"
              iconClassName="size-6"
            />
            <div className="min-w-0 flex-1">
              <PostMeta article={article} locale={locale} />
              <h3 className="mt-1 text-balance text-base font-extrabold leading-snug text-[var(--color-main)] underline-offset-4 group-hover:underline">
                {article.title}
              </h3>
              {article.metaDescription ? (
                <p className="mt-1 line-clamp-2 text-sm font-semibold text-[var(--color-body)] sm:line-clamp-1">
                  {article.metaDescription}
                </p>
              ) : null}
            </div>
            <ChevronRight className="size-5 shrink-0 text-[var(--color-secondary)]" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}
