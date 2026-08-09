"use client";

import type { ForumTrendItem } from "@mentor/types";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export function TrendTopicList({ items }: { items: ForumTrendItem[] }) {
  const t = useTranslations("community");

  return (
    <div>
      {items.map((item) => (
        <Link
          key={item.id}
          href={{ pathname: "/community/feed", query: { tag: item.slug } }}
          className="block min-h-20 border-t border-[#e7e9ee] px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-focus-ring)]"
        >
          <span className="block text-xs leading-5 text-[var(--color-secondary)]">
            {item.examType
              ? t("trends_exam_context", { exam: item.examType })
              : t("trends_general_context")}
          </span>
          <span className="block truncate text-[15px] font-extrabold text-[var(--color-main)]">
            #{item.name}
          </span>
          <span className="mt-0.5 block text-xs text-[var(--color-secondary)]">
            {t("trends_post_count", { count: item.threadCount })}
          </span>
        </Link>
      ))}
    </div>
  );
}
