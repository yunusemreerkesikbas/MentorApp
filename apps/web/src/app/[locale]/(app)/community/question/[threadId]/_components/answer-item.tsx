"use client";

import type { ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { AnswerView } from "@mentor/types";
import { Card, Chip } from "@mentor/ui";
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
  onToggleBookmark,
  accept,
  report,
}: {
  answer: AnswerView;
  shareHref: ShareHref;
  onToggleBookmark: (adding: boolean) => void;
  accept?: ReactNode;
  report?: ReactNode;
}) {
  const t = useTranslations("community");
  const locale = useLocale();
  const when = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(answer.createdAt),
  );

  return (
    <Card solid={answer.isAccepted}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs" style={{ color: "var(--color-secondary)" }}>
          {when}
        </span>
        {answer.isAccepted ? (
          <Chip>
            <span style={{ color: "var(--color-progress)" }}>✓ {t("accepted")}</span>
          </Chip>
        ) : null}
      </div>
      <p className="mt-2 whitespace-pre-wrap text-base" style={{ color: "var(--color-main)" }}>
        <MentionText text={answer.body} />
      </p>
      <AttachmentGallery attachments={answer.attachments} />
      <div className="-ml-1.5 mt-3 flex items-center gap-1">
        <SendButton href={shareHref} />
        <BookmarkButton bookmarked={answer.myBookmarked} onToggle={onToggleBookmark} />
        {accept}
        {report}
      </div>
    </Card>
  );
}
