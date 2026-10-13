"use client";

import { ChevronRight, Hash } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ForumHubView } from "@mentor/types";
import { Link } from "@/i18n/navigation";
import { PANEL_CARD, PANEL_CARD_TITLE, PANEL_TEXT_LINK } from "@/components/panel/panel-styles";
import { AuthorAvatar } from "./author-avatar";
import { COMMUNITY_ROW_LIST } from "./community-row";

/** People who replied to someone this week. Nothing to say → no card (DESIGN.md §10). */
export function HubSupporters({ people }: { people: ForumHubView["supporters"] }) {
  const t = useTranslations("community");
  if (people.length === 0) return null;
  const [first, second] = people;
  const line =
    people.length === 1
      ? t("hub_supporters_one", { a: first!.displayName })
      : people.length === 2
        ? t("hub_supporters_two", { a: first!.displayName, b: second!.displayName })
        : t("hub_supporters_many", {
            a: first!.displayName,
            b: second!.displayName,
            count: people.length - 2,
          });

  return (
    <section className={`${PANEL_CARD} flex flex-col gap-3`} aria-labelledby="hub-supporters-title">
      <h2 id="hub-supporters-title" className={PANEL_CARD_TITLE}>
        {t("hub_supporters")}
      </h2>
      <div className="flex items-center gap-3">
        <span className="flex shrink-0" aria-hidden>
          {people.slice(0, 5).map((person, index) => (
            <span
              key={person.id}
              className={`rounded-full ring-2 ring-[var(--color-surface)] ${index > 0 ? "-ml-2" : ""}`}
            >
              <AuthorAvatar name={person.displayName} src={person.avatarUrl} size={32} />
            </span>
          ))}
        </span>
        <p className="text-caption font-semibold text-[var(--color-body)]">{line}</p>
      </div>
    </section>
  );
}

/** Tags people are talking about. Tags are optional on posts, so this is often empty: then no card. */
export function HubTrends({ tags }: { tags: ForumHubView["trendingTags"] }) {
  const t = useTranslations("community");
  if (tags.length === 0) return null;

  return (
    <section className={`${PANEL_CARD} flex flex-col gap-1`} aria-labelledby="hub-trends-title">
      <div className="flex items-center justify-between gap-3">
        <h2 id="hub-trends-title" className={PANEL_CARD_TITLE}>
          {t("trends_title")}
        </h2>
        <Link href={{ pathname: "/community/feed", query: { sort: "top" } }} className={PANEL_TEXT_LINK}>
          {t("see_all")}
          <ChevronRight size={16} aria-hidden />
        </Link>
      </div>
      <div className={COMMUNITY_ROW_LIST}>
        {tags.slice(0, 4).map((tag) => (
          <Link
            key={tag.id}
            href={{ pathname: "/community/feed", query: { tag: tag.slug } }}
            className="flex min-h-12 items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-focus-ring)]"
          >
            <Hash size={18} strokeWidth={1.75} className="shrink-0 text-[var(--play-selected-ink)]" aria-hidden />
            <span className="min-w-0 flex-1 truncate text-sm font-extrabold text-[var(--color-main)]">{tag.slug}</span>
            <span className="shrink-0 text-caption font-semibold text-[var(--color-secondary)]">
              {t("trends_post_count", { count: tag.threadCount })}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
