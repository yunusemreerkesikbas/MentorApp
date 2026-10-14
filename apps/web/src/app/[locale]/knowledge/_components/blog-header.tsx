import { getTranslations } from "next-intl/server";
import { blogHref, type BlogQuery } from "@/lib/blog-url";
import { ARTICLE_CATEGORIES, EXAM_FAMILIES } from "@/lib/content-api";
import { BlogTabs } from "./blog-tabs";

/**
 * The page speaks for itself (analysis header pattern): title and the exam switch, then the topics
 * over the list. Both filters are `SlidingTabs`: a pill for the exam, an underline for the topic.
 */
export async function BlogHeader({ query }: { query: BlogQuery }) {
  const t = await getTranslations("knowledge");

  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-display font-extrabold leading-tight tracking-[-0.01em] text-[var(--color-main)]">
            {t("title")}
          </h1>
          <p className="mt-1.5 text-body-sm font-semibold text-[var(--color-secondary)]">
            {t("subtitle")}
          </p>
        </div>
        <div className="sm:shrink-0">
          <BlogTabs
            variant="pill"
            ariaLabel={t("families_label")}
            value={query.family}
            tabs={EXAM_FAMILIES.map((family) => ({
              id: family,
              label: t(`families.${family.toLowerCase()}`),
              href: blogHref({ family, category: query.category }),
            }))}
          />
        </div>
      </div>
      <BlogTabs
        variant="underline"
        ariaLabel={t("topics_label")}
        value={query.category ?? "ALL"}
        tabs={[null, ...ARTICLE_CATEGORIES].map((category) => ({
          id: category ?? "ALL",
          label: category ? t(`categories.${category.toLowerCase()}`) : t("all_topics"),
          href: blogHref({ family: query.family, category }),
        }))}
      />
    </div>
  );
}
