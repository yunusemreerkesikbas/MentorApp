"use client";

import { useLocale, useTranslations } from "next-intl";
import type { ThreadView } from "@mentor/types";
import { Chip } from "@mentor/ui";
import { Link } from "@/i18n/navigation";
import { relativeTime } from "@/lib/relative-time";
import { AuthorAvatar } from "../../_components/author-avatar";
import { questionMarkdownToPlainText } from "../../feed/_components/question-composer-state";

export function QuestionListItem({ question }: { question: ThreadView }) {
  const t = useTranslations("community");
  const locale = useLocale();
  return (
    <Link
      href={{
        pathname: "/community/question/[threadId]",
        params: { threadId: question.id },
      }}
      className="block rounded-2xl bg-[var(--color-surface)] px-5 py-4 transition-shadow duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
      style={{ border: "1px solid var(--color-border)" }}
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
        {questionMarkdownToPlainText(question.body)}
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
