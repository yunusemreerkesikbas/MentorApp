"use client";

import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { AnswerView } from "@mentor/types";
import { relativeTime } from "@/lib/relative-time";
import { AttachmentGallery } from "../../../_components/attachment-gallery";
import { AuthorAvatar } from "../../../_components/author-avatar";
import { AuthorLink } from "../../../_components/author-link";
import { MentionText } from "../../../_components/mention-text";
import {
  SendButton,
  type ShareHref,
} from "../../../_components/send-button";
import { BookmarkButton } from "../../../_components/bookmark-button";
import { HelpfulButton } from "../../../_components/helpful-button";

/**
 * One answer: who wrote it, what they said, "Faydalı" first. The accepted answer sits in a green
 * frame with a "Çözüm" line, no tinted fill (canvas revision, 2026-10-07). `accept`/`report` are
 * slots filled by the shell. QA answers have no page of their own, so "send" shares the question.
 */
export function AnswerItem({
  answer,
  shareHref,
  sharePublicUrl,
  onToggleBookmark,
  onToggleHelpful,
  accept,
  report,
}: {
  answer: AnswerView;
  shareHref: ShareHref;
  /** Anonymous URL of the parent question, when it is publicly indexable. */
  sharePublicUrl?: string;
  onToggleBookmark: (adding: boolean) => void;
  onToggleHelpful: (adding: boolean) => void;
  accept?: ReactNode;
  report?: ReactNode;
}) {
  const t = useTranslations("community");
  const locale = useLocale();

  return (
    <article
      className={
        answer.isAccepted
          ? "flex gap-3 rounded-[var(--radius-card)] border-2 border-[var(--color-success)] p-4"
          : "flex gap-3 py-4"
      }
    >
      <AuthorLink username={answer.authorUsername} className="shrink-0">
        <AuthorAvatar name={answer.authorName} src={answer.authorAvatarUrl} size={32} />
      </AuthorLink>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {answer.isAccepted ? (
          <span className="inline-flex items-center gap-1 text-caption font-extrabold text-[var(--color-success)]">
            <Check size={15} strokeWidth={2.5} aria-hidden />
            {t("answer_solution")}
          </span>
        ) : null}
        <div className="flex min-w-0 items-center gap-1.5">
          <AuthorLink username={answer.authorUsername} className="min-w-0 truncate hover:underline">
            <span className="text-body-sm font-extrabold text-[var(--color-main)]">
              {answer.authorName || t("unknown_author")}
            </span>
          </AuthorLink>
          {answer.authorUsername ? (
            <span className="min-w-0 truncate text-caption font-semibold text-[var(--color-secondary)]">
              @{answer.authorUsername}
            </span>
          ) : null}
          <span className="shrink-0 whitespace-nowrap text-caption font-semibold text-[var(--color-secondary)]">
            · {relativeTime(answer.createdAt, locale)}
          </span>
        </div>
        <p className="whitespace-pre-wrap break-words text-body-sm font-semibold text-[var(--color-body)]">
          <MentionText text={answer.body} />
        </p>
        <AttachmentGallery attachments={answer.attachments} />
        <div className="-ml-2 flex flex-wrap items-center gap-1">
          <HelpfulButton
            count={answer.helpfulVoteCount ?? 0}
            selected={answer.myHelpfulVote ?? false}
            canVote={answer.canHelpfulVote ?? true}
            onToggle={onToggleHelpful}
          />
          <SendButton href={shareHref} publicUrl={sharePublicUrl} />
          <BookmarkButton bookmarked={answer.myBookmarked} onToggle={onToggleBookmark} />
          {accept}
          <span className="ml-auto">{report}</span>
        </div>
      </div>
    </article>
  );
}
