"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Clock } from "lucide-react";
import { useTranslations } from "next-intl";
import { useReducedMotion } from "framer-motion";
import type { CommunitySummary, LeaderboardView, LeaderboardWindow } from "@mentor/types";
import { Skeleton, SkeletonGroup } from "@mentor/ui";
import { CompanionBubble } from "@/components/panel/companion-bubble";
import {
  PANEL_CARD,
  PANEL_GRID_CLASS,
  PANEL_MAIN_CLASS,
  PANEL_QUIET_LINK,
  PANEL_TEXT_LINK,
} from "@/components/panel/panel-styles";
import { SegmentPillControl } from "@/components/segment-pill-control";
import { Link } from "@/i18n/navigation";
import { getCommunityLeaderboard, getCommunitySummary } from "@/lib/community";
import { BadgeStrip } from "../../_components/badge-strip";
import { CommunityPresenceCard } from "../../_components/community-presence";
import { LeagueList } from "./league-list";
import { nextLeagueReset } from "./league-reset";
import { LeagueYouCard } from "./league-you-card";

const WINDOWS: readonly LeaderboardWindow[] = ["today", "weekly", "all_time"];
const TAB_LABEL = { today: "rank_today", weekly: "rank_weekly", all_time: "rank_alltime" } as const;
const TITLE = { today: "rank_title_today", weekly: "rank_page_title", all_time: "rank_title_alltime" } as const;
const SUBTITLE = { today: "rank_subtitle_today", weekly: "rank_subtitle_weekly", all_time: "rank_subtitle_alltime" } as const;

/**
 * Haftalık lig on the panel frame: the window (Bugün · Bu hafta · Tüm zamanlar), your card, then the
 * league in one card; the rail holds your badges and who is studying now. Effort, never shame
 * (AGENTS.md §4): placement is said, the cheer is always about your own XP.
 */
export function LeaderboardScreen() {
  const t = useTranslations("community");
  const reduce = useReducedMotion() ?? false;
  const [data, setData] = useState<CommunitySummary | null>(null);
  const [failed, setFailed] = useState(false);
  const [activeWindow, setActiveWindow] = useState<LeaderboardWindow>("weekly");
  const [boards, setBoards] = useState<Partial<Record<LeaderboardWindow, LeaderboardView>>>({});
  const [failedWindows, setFailedWindows] = useState<Set<LeaderboardWindow>>(new Set());

  useEffect(() => {
    let active = true;
    getCommunitySummary()
      .then((res) => {
        if (!active) return;
        setData(res);
        const weekly = res.leaderboard; // the summary carries the weekly board, so that tab never refetches
        if (weekly) setBoards((b) => ({ ...b, weekly }));
      })
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!data?.economyEnabled || boards[activeWindow] || failedWindows.has(activeWindow)) return;
    let active = true;
    getCommunityLeaderboard(activeWindow)
      .then((res) => active && setBoards((b) => ({ ...b, [activeWindow]: res })))
      .catch(() => active && setFailedWindows((s) => new Set(s).add(activeWindow)));
    return () => {
      active = false;
    };
  }, [activeWindow, data?.economyEnabled, boards, failedWindows]);

  const economyOn = data?.economyEnabled ?? false;
  const board = boards[activeWindow] ?? null;
  const boardFailed = failedWindows.has(activeWindow);

  // Only reached once the board is in or has failed: loading draws its own skeleton below.
  const boardBody =
    board === null ? (
      <div className={`${PANEL_CARD} flex flex-col items-start gap-1`}>
        <p className="text-body-sm font-semibold text-[var(--color-secondary)]">{t("error")}</p>
        <button
          type="button"
          className={PANEL_QUIET_LINK}
          onClick={() =>
            setFailedWindows((s) => {
              const next = new Set(s);
              next.delete(activeWindow);
              return next;
            })
          }
        >
          {t("refresh")}
        </button>
      </div>
    ) : board.items.length === 0 ? (
      <div className={`${PANEL_CARD} flex flex-col gap-3`}>
        <CompanionBubble puhu="encouraging" text={t("leaderboard_empty")} />
        <Link href="/study-session" className={`${PANEL_TEXT_LINK} self-start`}>
          {t("rank_start_session")}
          <ChevronRight size={16} aria-hidden />
        </Link>
      </div>
    ) : (
      <>
        <LeagueYouCard key={activeWindow} me={board.me} total={board.totalParticipants} reduceMotion={reduce} />
        <LeagueList items={board.items} me={board.me} total={board.totalParticipants} />
      </>
    );

  return (
    <main className={PANEL_MAIN_CLASS}>
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h1 className="text-2xl font-extrabold tracking-[-0.01em] text-[var(--color-main)] sm:text-display">
            {t(TITLE[activeWindow])}
          </h1>
          {economyOn ? <ResetCountdown window={activeWindow} /> : null}
        </div>
        <p className="text-body-sm font-semibold text-[var(--color-secondary)]">{t(SUBTITLE[activeWindow])}</p>
      </div>

      <div className={PANEL_GRID_CLASS}>
        <section className="flex min-w-0 flex-col gap-4" aria-busy={data === null && !failed}>
          {failed ? (
            <p className={`${PANEL_CARD} text-body-sm font-semibold text-[var(--color-secondary)]`}>{t("error")}</p>
          ) : data === null ? (
            <SkeletonGroup label={t("loading")} className="flex flex-col gap-4">
              <Skeleton className="h-12 w-full max-w-md rounded-[var(--radius-card)]" />
              <Skeleton className="h-24 w-full rounded-[var(--radius-card)]" />
              <Skeleton className="h-96 w-full rounded-[var(--radius-card)]" />
            </SkeletonGroup>
          ) : !economyOn ? (
            <p className={`${PANEL_CARD} text-body-sm font-semibold text-[var(--color-secondary)]`}>
              {t("leaderboard_empty")}
            </p>
          ) : (
            <>
              {/* The window switch stays put while a window's board loads; only the board waits. */}
              <div className="sm:max-w-md">
                <SegmentPillControl
                  items={WINDOWS.map((w) => ({ id: w, label: t(TAB_LABEL[w]) }))}
                  value={activeWindow}
                  onChange={(value) => setActiveWindow(value as LeaderboardWindow)}
                  ariaLabel={t("rank_window_label")}
                  idPrefix="league-window"
                  equalWidth
                />
              </div>
              {board === null && !boardFailed ? (
                <SkeletonGroup label={t("loading")} className="flex flex-col gap-4">
                  <Skeleton className="h-24 w-full rounded-[var(--radius-card)]" />
                  <Skeleton className="h-96 w-full rounded-[var(--radius-card)]" />
                </SkeletonGroup>
              ) : (
                boardBody
              )}
            </>
          )}
        </section>

        <aside className="flex min-w-0 flex-col gap-5" aria-label={t("hub_rail_label")}>
          {data && data.badges.length > 0 ? (
            <section className={PANEL_CARD}>
              <BadgeStrip badges={data.badges} detailed />
            </section>
          ) : null}
          <CommunityPresenceCard />
        </aside>
      </div>
    </main>
  );
}

/** "Lig 2g 5s sonra yenilenir", ticking each minute; the all-time league never resets. */
function ResetCountdown({ window }: { window: LeaderboardWindow }) {
  const t = useTranslations("community");
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const label = useMemo(() => {
    const next = nextLeagueReset(window, now);
    if (!next) return null;
    const ms = next.getTime() - now.getTime();
    if (ms <= 0) return t("rank_reset_soon");
    const totalMinutes = Math.floor(ms / 60_000);
    const days = Math.floor(totalMinutes / (60 * 24));
    const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
    const minutes = totalMinutes % 60;
    const time = days >= 1 ? t("rank_reset_dh", { days, hours }) : t("rank_reset_hm", { hours, minutes });
    return t("rank_reset", { time });
  }, [now, t, window]);

  if (!label) return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-caption font-bold text-[var(--color-secondary)]">
      <Clock size={14} aria-hidden />
      {label}
    </span>
  );
}
