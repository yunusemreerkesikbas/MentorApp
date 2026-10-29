import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { fetchInfoArticlesByFamily } from "@/lib/content-api";
import { ArticleCover } from "../../knowledge/_components/article-cover";
import { PostMeta } from "../../knowledge/_components/post-meta";
import { PAGE_FRAME, PAPER_PILL, PAPER_TITLE } from "./landing-paper";

/**
 * "Blog'dan": the three latest posts as cards, linking into the blog. Post titles may name an exam;
 * that is the one place the landing does (docs/copy/voice.md). Rendered inside Suspense; no posts or
 * no API means no section.
 */
export async function LandingBlog() {
  const [t, locale, list] = await Promise.all([
    getTranslations("landing.blog_section"),
    getLocale(),
    // The blog hub's default family; the landing has no exam of its own to pick.
    fetchInfoArticlesByFamily("KPSS", 1, 3, { revalidate: 3600 }).catch(() => null),
  ]);
  if (!list || list.items.length === 0) return null;

  return (
    <section id="blog" aria-labelledby="landing-blog-title" className={`${PAGE_FRAME} scroll-mt-24 pt-16 lg:pt-24`}>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <p className={`${PAPER_PILL} bg-[var(--landing-pill)] text-[var(--landing-pill-ink)]`}>{t("pill")}</p>
          <h2 id="landing-blog-title" className={PAPER_TITLE}>
            {t("title")}
          </h2>
        </div>
        <Link
          href="/knowledge"
          className="inline-flex min-h-11 items-center text-base font-extrabold text-[var(--landing-coach)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
        >
          {t("all")} →
        </Link>
      </div>
      <ul className="mt-6 grid gap-4 md:grid-cols-3">
        {list.items.map((article) => (
          <li key={article.slug}>
            <Link
              href={{ pathname: "/knowledge/[slug]", params: { slug: article.slug } }}
              className="group flex h-full flex-col gap-3 rounded-[var(--radius-card)] border border-[var(--landing-paper-line)] bg-[var(--color-surface)] p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
            >
              <ArticleCover article={article} className="aspect-[16/9] w-full" />
              <PostMeta article={article} locale={locale} />
              <h3 className="text-balance text-lg font-extrabold leading-snug text-[var(--landing-ink)] underline-offset-4 group-hover:underline">
                {article.title}
              </h3>
              {article.metaDescription ? (
                <p className="line-clamp-2 text-sm font-semibold text-[var(--landing-ink-soft)]">{article.metaDescription}</p>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
