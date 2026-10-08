"use client";

import { ChevronRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { ForumFeedItem, ForumHubView } from "@mentor/types";
import { Link } from "@/i18n/navigation";
import { relativeTime } from "@/lib/relative-time";
import { PANEL_CARD, PANEL_CARD_TITLE, PANEL_TEXT_LINK } from "@/components/panel/panel-styles";
import { COMMUNITY_ROW_LIST, CommunityRow } from "./community-row";
import { questionStatus } from "./question-status";
import { QuestionStatusLabel } from "./question-status-label";
import { threadHref } from "./thread-href";
import { ZoneTypeIcon } from "./zone-type-icon";

const MAX_ROWS = 4;

/** "Kaldığın yerden": the featured discussion first, then what you touched or what is new. */
export function HubDiscussions({ hub }: { hub: ForumHubView }) {
  const t = useTranslations("community");
  const locale = useLocale();
  const rows = [
    ...(hub.featured ? [{ item: hub.featured, featured: true }] : []),
    ...hub.continueDiscussions
      .filter((item) => item.id !== hub.featured?.id)
      .map((item) => ({ item, featured: false })),
  ].slice(0, MAX_ROWS);

  if (rows.length === 0) return null;

  const meta = (item: ForumFeedItem) => {
    const status = item.zone.type === "QA" ? questionStatus(item) : null;
    const count =
      status === null
        ? t("comment_total", { count: item.commentCount })
        : status.kind === "waiting"
          ? t("status_waiting")
          : t("status_answers", { count: status.answers });
    return [item.zone.title, count, relativeTime(item.lastActivityAt, locale)].join(" · ");
  };

  return (
    <section className={`${PANEL_CARD} flex flex-col gap-1`} aria-labelledby="hub-continue-title">
      <div className="flex items-center justify-between gap-3">
        <h2 id="hub-continue-title" className={PANEL_CARD_TITLE}>
          {t("hub_continue")}
        </h2>
        <Link href="/community/feed" className={PANEL_TEXT_LINK}>
          {t("hub_open_feed")}
          <ChevronRight size={16} aria-hidden />
        </Link>
      </div>
      <div className={COMMUNITY_ROW_LIST}>
        {rows.map(({ item, featured }) => {
          const status = item.zone.type === "QA" ? questionStatus(item) : null;
          return (
            <CommunityRow
              key={item.id}
              href={threadHref(item)}
              icon={<ZoneTypeIcon type={item.zone.type} size={20} strokeWidth={1.75} />}
              eyebrow={featured ? t("hub_featured_eyebrow") : undefined}
              title={item.title ?? item.body}
              meta={meta(item)}
              trailing={
                status?.kind === "solved" ? (
                  <QuestionStatusLabel status={status} />
                ) : (
                  <ChevronRight size={18} className="shrink-0 text-[var(--color-secondary)]" aria-hidden />
                )
              }
            />
          );
        })}
      </div>
    </section>
  );
}
