"use client";

import { useLocale, useTranslations } from "next-intl";
import type { ThreadView } from "@mentor/types";
import { Chip } from "@mentor/ui";
import { Link } from "@/i18n/navigation";
import { relativeTime } from "@/lib/relative-time";
import { AuthorAvatar } from "../../_components/author-avatar";

export function QuestionListItem({ question }: { question: ThreadView }) {
  const t = useTranslations("topluluk");
  const locale = useLocale();
  return (
    <Link
      href={`/topluluk/soru/${question.id}`}
      className="block rounded-2xl bg-white px-5 py-4 transition-shadow duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
      style={{ border: "1px solid rgba(0,0,0,0.08)" }}
    >
      <div className="flex items-start justify-between gap-3">
        <h3
          className="text-sm font-semibold leading-snug"
          style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
        >
          {question.title ?? question.body.slice(0, 80)}
        </h3>
        {question.status === "ANSWERED" ? <Chip>{t("answered")}</Chip> : null}
      </div>
      <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed" style={{ color: "var(--color-secondary)" }}>
        {question.body}
      </p>
      <div className="mt-3 flex items-center gap-2">
        <AuthorAvatar name={question.authorName} size={20} src={question.authorAvatarUrl} />
        <span className="text-xs" style={{ color: "var(--color-secondary)" }}>
          {question.authorName || t("unknown_author")}
        </span>
        <span className="text-xs" style={{ color: "var(--color-secondary)" }}>
          · {relativeTime(question.createdAt, locale)}
        </span>
      </div>
    </Link>
  );
}
