"use client";

import type { ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { AnswerView } from "@mentor/types";
import { AttachmentGallery } from "../../../_components/attachment-gallery";
import { MentionText } from "../../../_components/mention-text";
import {
  SendButton,
  type ShareHref,
} from "../../../_components/send-button";
import { BookmarkButton } from "../../../_components/bookmark-button";

/**
 * One answer. Accepted answers are highlighted; `accept`/`report` are slots filled by the shell.
 * QA answers have no page of their own, so "send" shares the parent question (`shareHref`).
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
  const when = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(answer.createdAt),
  );

  return (
    <article className={answer.isAccepted ? "rounded-[12px] bg-[#eaf7f0] p-4" : "border-b border-[#eceef2] px-1 py-4"}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs" style={{ color: "var(--color-secondary)" }}>
          {when}
        </span>
        {answer.isAccepted ? (
          <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-[#287954]">
            ✓ {t("accepted")}
          </span>
        ) : null}
      </div>
      <p className="mt-2 whitespace-pre-wrap text-base" style={{ color: "var(--color-main)" }}>
        <MentionText text={answer.body} />
      </p>
      <AttachmentGallery attachments={answer.attachments} />
      <div className="-ml-1.5 mt-3 flex items-center gap-1">
        <SendButton href={shareHref} publicUrl={sharePublicUrl} />
        <BookmarkButton bookmarked={answer.myBookmarked} onToggle={onToggleBookmark} />
        <button
          type="button"
          aria-pressed={answer.myHelpfulVote ?? false}
          onClick={() => onToggleHelpful(!(answer.myHelpfulVote ?? false))}
          className="min-h-11 rounded-full px-3 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
          style={{ background: answer.myHelpfulVote ? "#eaf7f0" : "transparent", color: answer.myHelpfulVote ? "#287954" : undefined }}
        >
          +1 {t("helpful")} · {answer.helpfulVoteCount ?? 0}
        </button>
        {accept}
        {report}
      </div>
    </article>
  );
}
