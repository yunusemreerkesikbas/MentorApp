import { AltArrowLeftIcon } from "@solar-icons/react/linear/alt-arrow-left";
import { AltArrowRightIcon } from "@solar-icons/react/linear/alt-arrow-right";
import { getTranslations } from "next-intl/server";
import { PANEL_CARD, PANEL_CARD_TITLE } from "@/components/panel/panel-styles";
import { getPathname, Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import {
  BLOG_PAGE_SIZE,
  blogHref,
  emptyListKind,
  showsFeatured,
  type BlogQuery,
} from "@/lib/blog-url";
import { loadBlogPosts } from "./blog-posts";
import { BLOG_ACTION } from "./blog-ui";
import { FeaturedPost } from "./featured-post";
import { PostRows } from "./post-rows";

/** Featured post, rows and pages for one family/topic/page. The header never waits for this section. */
export async function PostsSection({ query, locale }: { query: BlogQuery; locale: string }) {
  const [t, { featured, list }] = await Promise.all([
    getTranslations("knowledge"),
    loadBlogPosts(query.family, query.category, query.page),
  ]);

  if (!list) {
    return (
      <section aria-live="polite" className={`${PANEL_CARD} flex flex-col items-start gap-1`}>
        <p className="text-body-sm font-semibold text-[var(--color-body)]">{t("list_error")}</p>
        {/* A full reload, not a soft navigation: the failed request is the one to repeat. */}
        <a
          href={getPathname({ locale: locale as Locale, href: blogHref(query) })}
          className={BLOG_ACTION}
        >
          {t("retry")}
        </a>
      </section>
    );
  }

  const hero = featured && showsFeatured(featured, query) ? featured : null;
  const pages = Math.max(1, Math.ceil(list.total / BLOG_PAGE_SIZE));

  if (!hero && list.items.length === 0) {
    const kind = emptyListKind(query);
    const pastEnd = kind === "page";
    return (
      <section className={`${PANEL_CARD} flex flex-col items-start gap-2`}>
        <h2 className={PANEL_CARD_TITLE}>
          {t(pastEnd ? "empty_page_title" : kind === "topic" ? "empty_topic_title" : "empty_title")}
        </h2>
        {pastEnd ? null : (
          <p className="text-body-sm font-semibold text-[var(--color-secondary)]">{t("empty_desc")}</p>
        )}
        {kind !== "family" ? (
          <Link
            href={blogHref({ family: query.family, category: pastEnd ? query.category : null })}
            scroll={false}
            className={BLOG_ACTION}
          >
            {t(pastEnd ? "first_page_link" : "all_topics_link")}
            <AltArrowRightIcon size={16} strokeWidth={1.75} />
          </Link>
        ) : null}
      </section>
    );
  }

  return (
    <>
      {hero ? <FeaturedPost article={hero} locale={locale} /> : null}
      {list.items.length > 0 ? <PostRows articles={list.items} locale={locale} /> : null}
      {pages > 1 ? (
        <nav aria-label={t("pagination_label")} className="flex items-center justify-center gap-4">
          {query.page > 1 ? (
            <Link href={blogHref({ ...query, page: query.page - 1 })} className={BLOG_ACTION}>
              <AltArrowLeftIcon size={16} strokeWidth={1.75} />
              {t("pagination_prev")}
            </Link>
          ) : null}
          <p className="text-caption font-extrabold tabular-nums text-[var(--color-secondary)]">
            {t("pagination_page", { page: query.page, pages })}
          </p>
          {query.page < pages ? (
            <Link href={blogHref({ ...query, page: query.page + 1 })} className={BLOG_ACTION}>
              {t("pagination_next")}
              <AltArrowRightIcon size={16} strokeWidth={1.75} />
            </Link>
          ) : null}
        </nav>
      ) : null}
    </>
  );
}
