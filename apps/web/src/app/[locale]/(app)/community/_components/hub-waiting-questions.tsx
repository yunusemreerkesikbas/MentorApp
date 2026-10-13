"use client";

import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { ForumFeedItem } from "@mentor/types";
import { Link } from "@/i18n/navigation";
import { getForumFeed } from "@/lib/forum";
import { relativeTime } from "@/lib/relative-time";
import { PANEL_CARD, PANEL_CARD_TITLE, PANEL_TEXT_LINK } from "@/components/panel/panel-styles";
import { COMMUNITY_ROW_LIST, CommunityRow } from "./community-row";
import { threadHref } from "./thread-href";
import { ZoneTypeIcon } from "./zone-type-icon";

/**
 * Other people's questions nobody has answered yet. Loads on its own and says nothing until it
 * has a question to show (DESIGN.md §1 rule 7, §10). A question page passes its own id as `exclude`.
 */
export function HubWaitingQuestions({ exclude }: { exclude?: string }) {
  const t = useTranslations("community");
  const locale = useLocale();
  const [items, setItems] = useState<ForumFeedItem[]>([]);

  useEffect(() => {
    let active = true;
    getForumFeed({ scope: "relevant", sort: "recent", unanswered: true, limit: 4 })
      .then((feed) => {
        if (active) setItems(feed.items.filter((item) => item.id !== exclude).slice(0, 3));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [exclude]);

  if (items.length === 0) return null;

  return (
    <section className={`${PANEL_CARD} flex flex-col gap-1`} aria-labelledby="hub-waiting-title">
      <div className="flex items-center justify-between gap-3">
        <h2 id="hub-waiting-title" className={PANEL_CARD_TITLE}>
          {t("hub_waiting_title")}
        </h2>
        <Link
          href={{ pathname: "/community/feed", query: { content: "waiting" } }}
          className={PANEL_TEXT_LINK}
        >
          {t("hub_lend_hand")}
          <ChevronRight size={16} aria-hidden />
        </Link>
      </div>
      <div className={COMMUNITY_ROW_LIST}>
        {items.map((item) => (
          <CommunityRow
            key={item.id}
            href={threadHref(item)}
            icon={<ZoneTypeIcon type="QA" size={20} strokeWidth={1.75} />}
            title={item.title ?? item.body}
            meta={[item.zone.title, item.author.displayName, relativeTime(item.createdAt, locale)].join(" · ")}
            trailing={<ChevronRight size={18} className="shrink-0 text-[var(--color-secondary)]" aria-hidden />}
          />
        ))}
      </div>
    </section>
  );
}
