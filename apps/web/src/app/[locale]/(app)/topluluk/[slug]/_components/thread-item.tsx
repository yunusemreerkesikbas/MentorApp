"use client";

import type { ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { ThreadView } from "@mentor/types";
import { Card } from "@mentor/ui";
import { ReactionBar } from "./reaction-bar";

/** One feed item (CHAT message / ANNOUNCEMENT). `actions` is a slot for the report button (T6). */
export function ThreadItem({
  thread,
  onToggleReaction,
  actions,
}: {
  thread: ThreadView;
  onToggleReaction: (emoji: string, adding: boolean) => void;
  actions?: ReactNode;
}) {
  const t = useTranslations("topluluk");
  const locale = useLocale();
  const when = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(thread.createdAt),
  );

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs" style={{ color: "var(--color-secondary)" }}>
          {when}
          {thread.isPinned ? <span> · {t("pinned")}</span> : null}
        </span>
        {actions}
      </div>
      <p className="mt-2 whitespace-pre-wrap text-base" style={{ color: "var(--color-main)" }}>
        {thread.body}
      </p>
      <ReactionBar counts={thread.reactionCounts} mine={thread.myReactions} onToggle={onToggleReaction} />
    </Card>
  );
}
