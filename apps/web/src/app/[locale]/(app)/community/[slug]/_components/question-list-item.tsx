"use client";

import { useLocale, useTranslations } from "next-intl";
import type { ThreadView } from "@mentor/types";
import { Link } from "@/i18n/navigation";
import { relativeTime } from "@/lib/relative-time";
import { AuthorAvatar } from "../../_components/author-avatar";
import { questionStatus } from "../../_components/question-status";
import { QuestionStatusLabel } from "../../_components/question-status-label";
import { questionMarkdownToPlainText } from "../../feed/_components/question-composer-state";

/** One question row in a QA room: title and its one status, the excerpt, then who asked and when. */
export function QuestionListItem({ question }: { question: ThreadView }) {
  const t = useTranslations("community");
  const locale = useLocale();
  return (
    <Link
      href={{ pathname: "/community/question/[threadId]", params: { threadId: question.id } }}
      className="flex flex-col gap-1.5 px-5 py-4 transition-colors hover:bg-[color-mix(in_srgb,var(--color-main)_3%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none"
    >
      <span className="flex items-start justify-between gap-3">
        <span className="text-base font-extrabold leading-snug text-[var(--color-main)]">
          {question.title ?? question.body.slice(0, 80)}
        </span>
        <QuestionStatusLabel status={questionStatus(question)} />
      </span>
      <span className="line-clamp-2 text-body-sm font-semibold text-[var(--color-secondary)]">
        {questionMarkdownToPlainText(question.body)}
      </span>
      <span className="flex items-center gap-2 text-caption font-semibold text-[var(--color-secondary)]">
        <AuthorAvatar name={question.authorName} size={24} src={question.authorAvatarUrl} />
        {question.authorName || t("unknown_author")} · {relativeTime(question.createdAt, locale)}
      </span>
    </Link>
  );
}
