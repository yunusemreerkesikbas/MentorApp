import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { blogHref, type BlogQuery } from "@/lib/blog-url";
import { ARTICLE_CATEGORIES, EXAM_FAMILIES } from "@/lib/content-api";

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]";

/** The page speaks for itself (analysis header pattern): title, exam switch, topic chips over the list. */
export async function BlogHeader({ query }: { query: BlogQuery }) {
  const t = await getTranslations("knowledge");
  const topics = [null, ...ARTICLE_CATEGORIES];

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
        <nav
          aria-label={t("families_label")}
          className="flex gap-1 rounded-[var(--play-radius)] bg-[var(--color-surface-container)] p-1 sm:shrink-0"
        >
          {EXAM_FAMILIES.map((family) => {
            const on = family === query.family;
            return (
              <Link
                key={family}
                href={blogHref({ family, category: query.category })}
                scroll={false}
                aria-current={on ? "page" : undefined}
                className={`flex min-h-11 flex-1 items-center justify-center rounded-[var(--radius-card)] px-5 text-body-sm font-extrabold sm:flex-none ${FOCUS} ${
                  on
                    ? "bg-[var(--color-surface)] text-[var(--color-main)] shadow-[0_2px_0_var(--play-line)]"
                    : "text-[var(--color-secondary)] hover:text-[var(--color-main)]"
                }`}
              >
                {t(`families.${family.toLowerCase()}`)}
              </Link>
            );
          })}
        </nav>
      </div>
      <nav
        aria-label={t("topics_label")}
        className="-mx-5 flex gap-2 overflow-x-auto px-5 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0"
      >
        {topics.map((category) => {
          const on = category === query.category;
          return (
            <Link
              key={category ?? "all"}
              href={blogHref({ family: query.family, category })}
              scroll={false}
              aria-current={on ? "page" : undefined}
              className={`inline-flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-[var(--radius-card)] border px-4 text-sm font-extrabold ${FOCUS} ${
                on
                  ? "border-transparent bg-[var(--play-selected)] text-[var(--play-selected-ink)] shadow-[inset_0_0_0_2px_var(--play-cta)]"
                  : "border-[var(--play-line)] bg-[var(--color-surface)] text-[var(--color-main)] hover:border-[var(--color-secondary)]"
              }`}
            >
              {category ? t(`categories.${category.toLowerCase()}`) : t("all_topics")}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
