import { getTranslations } from "next-intl/server";
import type { InfoArticleSummaryDto } from "@mentor/types";
import { PANEL_CARD_TITLE } from "@/components/panel/panel-styles";
import { Link } from "@/i18n/navigation";
import { ArticleCover } from "../../_components/article-cover";
import { PostMeta } from "../../_components/post-meta";

/** Rail list rows (DESIGN §6.1): cover or category well, title, category · date. */
export async function RelatedPosts({
  related,
  locale,
}: {
  related: InfoArticleSummaryDto[];
  locale: string;
}) {
  const t = await getTranslations("knowledge");
  return (
    <section
      aria-labelledby="related-title"
      className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] px-5 pb-2 pt-5 shadow-[var(--shadow-card)]"
    >
      <h2 id="related-title" className={PANEL_CARD_TITLE}>
        {t("related_posts")}
      </h2>
      <ul className="mt-1">
        {related.map((article) => (
          <li key={article.slug} className="border-t border-[var(--color-border)] first:border-t-0">
            <Link
              href={{ pathname: "/knowledge/[slug]", params: { slug: article.slug } }}
              className="group flex items-center gap-3 rounded-[var(--radius-card)] py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
            >
              <ArticleCover article={article} className="size-12" iconClassName="size-5" />
              <div className="min-w-0">
                <h3 className="text-body-sm font-extrabold leading-snug text-[var(--color-main)] underline-offset-4 group-hover:underline">
                  {article.title}
                </h3>
                <PostMeta article={article} locale={locale} />
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
