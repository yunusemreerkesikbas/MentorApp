"use client";

import { useTranslations } from "next-intl";
import type { InfoArticleSummaryDto } from "@mentor/types";
import { Chip } from "@mentor/ui";
import { Link } from "@/i18n/navigation";
import { KNOWLEDGE_FEATURED_ASPECT_CLASS } from "./knowledge-layout";

export function FeaturedHero({ article }: { article: InfoArticleSummaryDto }) {
  const t = useTranslations("knowledge");

  return (
    <Link
      href={{ pathname: "/knowledge/[slug]", params: { slug: article.slug } }}
      className="group relative block overflow-hidden rounded-[var(--radius-card)] focus-visible:outline-none focus-visible:ring-2"
    >
      <div
        className={`relative ${KNOWLEDGE_FEATURED_ASPECT_CLASS} w-full bg-[var(--color-surface-container)]`}
      >
        {article.coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element -- editorial cover with known dimensions
          <img
            src={article.coverImage.url}
            alt={article.coverImage.alt}
            width={article.coverImage.width}
            height={article.coverImage.height}
            className="h-full w-full object-cover"
          />
        ) : null}
        <div
          className="absolute inset-x-0 bottom-0 p-4 lg:p-5"
          style={{
            background:
              "linear-gradient(transparent, color-mix(in srgb, #111111 78%, transparent))",
            backdropFilter: "blur(12px)",
          }}
        >
          <Chip size="sm" className="mb-2">
            {t(`categories.${article.category.toLowerCase()}`)}
          </Chip>
          <h2
            className="text-balance text-xl font-bold lg:text-2xl"
            style={{
              color: "#ffffff",
              fontFamily: "var(--font-heading)",
            }}
          >
            {article.title}
          </h2>
        </div>
      </div>
    </Link>
  );
}
