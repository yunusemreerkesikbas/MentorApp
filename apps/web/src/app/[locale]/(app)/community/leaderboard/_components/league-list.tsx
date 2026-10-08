"use client";

import { ChevronDown, ChevronUp, Medal, Minus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { LeaderboardEntry, RankMovement } from "@mentor/types";
import { PANEL_CARD_TITLE } from "@/components/panel/panel-styles";
import { AuthorAvatar } from "../../_components/author-avatar";
import { COMMUNITY_CARD_FLUSH } from "../../_components/community-row";
import { MEDAL } from "../../_components/leaderboard-medals";

/**
 * The league in one card: rank, a small medal for the first three, the person, how they moved and
 * their XP. You are the tinted row; below the shown places you come after a "···" gap.
 */
export function LeagueList({
  items,
  me,
  total,
}: {
  items: LeaderboardEntry[];
  me: LeaderboardEntry | null;
  total: number;
}) {
  const t = useTranslations("community");
  const meShown = me === null || items.some((entry) => entry.isMe);

  return (
    <section className={COMMUNITY_CARD_FLUSH} aria-labelledby="league-list-title">
      <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-5 sm:px-5">
        <h2 id="league-list-title" className={PANEL_CARD_TITLE}>
          {t("rank_list_title")}
        </h2>
        <span className="text-caption font-semibold tabular-nums text-[var(--color-secondary)]">
          {t("rank_participants", { count: total })}
        </span>
      </div>
      <ol>
        {items.map((entry) => (
          <LeagueRow key={entry.userId} entry={entry} />
        ))}
        {!meShown && me ? (
          <>
            <li aria-hidden className="border-t border-[var(--color-border)] py-1 text-center text-base font-black tracking-[0.2em] text-[var(--color-secondary)]">
              ···
            </li>
            <LeagueRow entry={me} />
          </>
        ) : null}
      </ol>
    </section>
  );
}

function LeagueRow({ entry }: { entry: LeaderboardEntry }) {
  const t = useTranslations("community");
  const locale = useLocale();
  const name = entry.isMe ? t("leaderboard_you") : entry.displayName;
  const medal = entry.rank <= 3 ? MEDAL[entry.rank - 1] : null;

  return (
    <li
      aria-current={entry.isMe ? "true" : undefined}
      className={`flex min-h-14 items-center gap-2 border-t border-[var(--color-border)] px-4 py-2 first:border-t-0 sm:gap-3 sm:px-5 ${entry.isMe ? "bg-[var(--play-selected)]" : ""}`}
    >
      <span className={`w-6 shrink-0 text-right sm:w-7 text-body-sm font-extrabold tabular-nums ${entry.isMe ? "text-[var(--play-selected-ink)]" : "text-[var(--color-secondary)]"}`}>
        {entry.rank}
      </span>
      <span className="flex w-5 shrink-0 justify-center" aria-hidden>
        {medal ? <Medal size={19} strokeWidth={2} style={{ color: medal }} /> : null}
      </span>
      <AuthorAvatar name={entry.displayName} src={entry.avatarUrl} size={32} />
      <span className={`min-w-0 flex-1 truncate text-body-sm ${entry.isMe ? "font-black text-[var(--play-selected-ink)]" : "font-bold text-[var(--color-main)]"}`}>
        {name}
      </span>
      <Movement movement={entry.movement} />
      <span className="shrink-0 text-right text-body-sm font-extrabold sm:w-20 tabular-nums text-[var(--color-main)]">
        {entry.xp.toLocaleString(locale)}
        <span className="ml-1 text-caption font-bold text-[var(--color-secondary)]">XP</span>
      </span>
    </li>
  );
}

/** Gentle: up in calm green, down in muted gray (never red), "yeni" for a first week. */
function Movement({ movement }: { movement: RankMovement }) {
  const t = useTranslations("community");
  const box = "flex w-8 shrink-0 justify-end sm:w-10";
  if (!movement) return <span className={box} />;
  if (movement === "new") {
    return <span className={`${box} text-caption font-extrabold text-[var(--play-selected-ink)]`}>{t("rank_new")}</span>;
  }
  if (movement === "same") {
    return (
      <span className={box}>
        <Minus size={16} aria-label={t("rank_move_same")} className="text-[var(--color-secondary)]" />
      </span>
    );
  }
  const up = movement === "up";
  const Icon = up ? ChevronUp : ChevronDown;
  return (
    <span className={box}>
      <Icon
        size={18}
        aria-label={up ? t("rank_move_up") : t("rank_move_down")}
        className={up ? "text-[var(--color-success)]" : "text-[var(--color-secondary)]"}
      />
    </span>
  );
}
