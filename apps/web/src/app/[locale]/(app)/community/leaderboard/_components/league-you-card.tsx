"use client";

import { useEffect, useState } from "react";
import { ChevronRight, ChevronUp } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { LeaderboardEntry } from "@mentor/types";
import { PANEL_CARD, PANEL_TEXT_LINK } from "@/components/panel/panel-styles";
import { Link } from "@/i18n/navigation";
import { AuthorAvatar } from "../../_components/author-avatar";

/** Counts a number up on mount (Duolingo's little XP roll). Instant under reduced motion. */
function useCountUp(target: number, reduce: boolean): number {
  const [n, setN] = useState(() => (reduce ? target : 0));
  useEffect(() => {
    if (reduce) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / 700);
      setN(Math.round(target * (1 - Math.pow(1 - p, 4))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, reduce]);
  return reduce ? target : n;
}

/**
 * "Ligde 14. sıradasın": your place, a cheer about effort (never about the people above you) and
 * your XP. Not on the board yet: an invitation to the first session instead.
 */
export function LeagueYouCard({
  me,
  total,
  reduceMotion,
}: {
  me: LeaderboardEntry | null;
  total: number;
  reduceMotion: boolean;
}) {
  const t = useTranslations("community");
  const locale = useLocale();
  const xp = useCountUp(me?.xp ?? 0, reduceMotion);

  if (!me) {
    return (
      <section className={`${PANEL_CARD} flex flex-col gap-1`} aria-label={t("rank_page_title")}>
        <p className="text-body-sm font-extrabold text-[var(--color-main)]">{t("leaderboard_you_none")}</p>
        <Link href="/study-session" className={`${PANEL_TEXT_LINK} self-start`}>
          {t("rank_start_session")}
          <ChevronRight size={16} aria-hidden />
        </Link>
      </section>
    );
  }

  // Ahead of at least 1%: still said as company, never as a percentage (voice.md, effort not place).
  const ahead = total > 1 && Math.round(((total - me.rank) / total) * 100) >= 1;
  const cheer =
    me.rank === 1
      ? t("rank_banner_top1")
      : me.rank <= 3
        ? t("rank_banner_top3")
        : ahead
          ? t("rank_percentile")
          : t("rank_banner_keep", { xp: me.xp.toLocaleString(locale) });

  return (
    <section className={`${PANEL_CARD} flex items-center gap-4 sm:px-6`} aria-labelledby="league-you-title">
      <span className="min-w-12 text-3xl font-black tabular-nums text-[var(--play-selected-ink)]" aria-hidden>
        {me.rank}.
      </span>
      <span className="hidden sm:block">
        <AuthorAvatar name={me.displayName} src={me.avatarUrl} size={48} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span id="league-you-title" className="text-base font-extrabold text-[var(--color-main)]">
          {t("rank_you_standing", { rank: me.rank })}
        </span>
        <span className="text-body-sm font-semibold text-[var(--color-body)]">{cheer}</span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-0.5">
        <span className="text-base font-extrabold tabular-nums text-[var(--color-main)]">
          {xp.toLocaleString(locale)} XP
        </span>
        {me.movement === "up" ? (
          <span className="inline-flex items-center gap-0.5 text-caption font-extrabold text-[var(--color-success)]">
            <ChevronUp size={16} aria-hidden />
            {t("rank_move_up")}
          </span>
        ) : me.movement === "new" ? (
          <span className="text-caption font-extrabold text-[var(--play-selected-ink)]">{t("rank_new")}</span>
        ) : null}
      </span>
    </section>
  );
}
