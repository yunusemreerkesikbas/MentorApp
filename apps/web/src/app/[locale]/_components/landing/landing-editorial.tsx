"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { InfoArticleSummaryDto } from "@mentor/types";
import { Card, SectionHeading } from "@mentor/ui";
import { INFO_ARTICLE_CATEGORY_LABELS } from "@/lib/content-labels";

/** Public editorial article links — SEO wedge, no auth required. */
export function LandingEditorial({
  articles,
}: {
  articles: InfoArticleSummaryDto[];
}) {
  const t = useTranslations("landing.editorial");

  if (articles.length === 0) return null;

  return (
    <section className="py-10 lg:py-14">
      <SectionHeading subtitle={t("subtitle")}>{t("heading")}</SectionHeading>
      <ul className="mt-6 flex flex-col gap-3">
        {articles.map((article) => (
          <li key={article.slug}>
            <Link
              href={`/bilgi/${article.slug}`}
              className="block rounded-[var(--radius-card)] focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none"
            >
              <Card className="transition-opacity hover:opacity-90 motion-reduce:transition-none">
                <p
                  className="text-base font-semibold"
                  style={{
                    color: "var(--color-main)",
                    fontFamily: "var(--font-heading)",
                  }}
                >
                  {article.title}
                </p>
                <p
                  className="mt-1 text-sm"
                  style={{ color: "var(--color-secondary)" }}
                >
                  {INFO_ARTICLE_CATEGORY_LABELS[article.category] ??
                    article.category}
                  {" · "}
                  {t("source_label")}: {article.source}
                </p>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
