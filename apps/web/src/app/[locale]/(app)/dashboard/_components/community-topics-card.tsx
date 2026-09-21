"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ChevronRight, MessageCircle } from "lucide-react";
import { ForumFeedScope, ForumFeedSort, type ForumFeedItem } from "@mentor/types";
import { Link } from "@/i18n/navigation";
import { getForumFeed } from "@/lib/forum";
import { relativeTime } from "@/lib/relative-time";
import { PANEL_CARD, PANEL_CARD_TITLE, PANEL_TEXT_LINK } from "./panel-styles";

/**
 * "Topluluktan": two live threads from the rooms that matter to this student. One small feed call
 * (`limit: 2`) instead of the old card's 100-room list that was fetched only to decide whether to
 * show a static promo. Forum off (404) or an empty feed → no card.
 */
export function CommunityTopicsCard() {
  const t = useTranslations("panel");
  const locale = useLocale();
  const [items, setItems] = useState<ForumFeedItem[]>([]);

  useEffect(() => {
    let active = true;
    getForumFeed({
      scope: ForumFeedScope.RELEVANT,
      sort: ForumFeedSort.TRENDING,
      limit: 2,
    })
      .then((feed) => {
        if (active) setItems(feed.items.slice(0, 2));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  if (items.length === 0) return null;

  return (
    <section
      className={`${PANEL_CARD} flex flex-col gap-1`}
      aria-labelledby="community-topics-title"
      data-testid="panel-community-topics"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="community-topics-title" className={PANEL_CARD_TITLE}>
          {t("community_title")}
        </h2>
        <Link href="/community" className={PANEL_TEXT_LINK}>
          {t("community_open")}
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      </div>
      <ul className="flex flex-col">
        {items.map((item) => (
          <li
            key={item.id}
            className="border-t border-[color-mix(in_srgb,var(--color-main)_7%,transparent)]"
          >
            <Link
              href={
                item.zone.type === "QA"
                  ? { pathname: "/community/question/[threadId]", params: { threadId: item.id } }
                  : { pathname: "/community/message/[threadId]", params: { threadId: item.id } }
              }
              className="flex items-center gap-3 py-2.5 outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
            >
              <span
                className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--play-selected)] text-[var(--play-selected-ink)]"
                aria-hidden
              >
                <MessageCircle className="size-5" strokeWidth={2.2} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 text-[15px] font-extrabold leading-snug text-[var(--color-main)]">
                  {item.title?.trim() || item.body}
                </span>
                <span className="block truncate text-[13px] text-[var(--color-secondary)]">
                  {t("community_meta", {
                    room: item.zone.title,
                    count: item.commentCount,
                    when: relativeTime(item.lastActivityAt, locale),
                  })}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
