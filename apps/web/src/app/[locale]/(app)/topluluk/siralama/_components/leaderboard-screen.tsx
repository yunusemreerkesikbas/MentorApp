"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { motion, useReducedMotion } from "framer-motion";
import ArrowLeft from "lucide-react/dist/esm/icons/arrow-left.mjs";
import Clock from "lucide-react/dist/esm/icons/clock.mjs";
import Crown from "lucide-react/dist/esm/icons/crown.mjs";
import Trophy from "lucide-react/dist/esm/icons/trophy.mjs";
import ChevronUp from "lucide-react/dist/esm/icons/chevron-up.mjs";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down.mjs";
import Minus from "lucide-react/dist/esm/icons/minus.mjs";
import type {
  CommunitySummary,
  LeaderboardEntry,
  LeaderboardView,
  LeaderboardWindow,
  RankMovement,
} from "@mentor/types";
import { Skeleton, SkeletonGroup } from "@mentor/ui";
import { Link } from "@/i18n/navigation";
import { getCommunityLeaderboard, getCommunitySummary } from "@/lib/community";
import { AuthorAvatar } from "../../_components/author-avatar";
import { BadgeStrip } from "../../_components/badge-strip";

/** Muted medal accents (calm, within-palette — no neon). */
const MEDAL = ["#C9A227", "#9AA3AF", "#BA7517"] as const; // gold · silver · bronze

/** Rank change vs the previous period. Gentle: ▲ calm green, ▼ muted gray (never red — §4). */
function MovementIndicator({ movement }: { movement: RankMovement }) {
  const t = useTranslations("topluluk");
  if (!movement) return null;
  if (movement === "new") {
    return (
      <span
        className="rounded-full px-1.5 py-px text-[9px] font-bold uppercase leading-tight"
        style={{ background: "color-mix(in srgb, var(--color-chip) 22%, white)", color: "var(--color-chip-text)" }}
      >
        {t("rank_new")}
      </span>
    );
  }
  if (movement === "same") {
    return <Minus size={12} aria-label={t("rank_move_same")} style={{ color: "var(--color-secondary)" }} />;
  }
  const up = movement === "up";
  const Icon = up ? ChevronUp : ChevronDown;
  return (
    <Icon
      size={14}
      aria-label={up ? t("rank_move_up") : t("rank_move_down")}
      style={{ color: up ? "var(--color-success)" : "var(--color-secondary)" }}
    />
  );
}

/** Count a number up to `target` on mount / when it changes. Instant under reduced motion. */
function useCountUp(target: number, reduce: boolean): number {
  const [n, setN] = useState(() => (reduce ? target : 0));
  useEffect(() => {
    if (reduce) return; // static — no animation, no synchronous setState in the effect
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / 700);
      setN(Math.round(target * (1 - Math.pow(1 - p, 4)))); // ease-out-quart, set inside rAF (async)
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, reduce]);
  return reduce ? target : n;
}

const IST_OFFSET_MS = 3 * 60 * 60 * 1000; // Europe/Istanbul (UTC+3, no DST) — matches the backend.

/** Next reset instant for a window (Istanbul day/week boundary); null for all_time (never resets). */
function nextResetIst(window: LeaderboardWindow, now: Date): Date | null {
  if (window === "all_time") return null;
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  let dayMs = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate());
  if (window === "today") {
    dayMs += 86_400_000; // next Istanbul midnight
  } else {
    dayMs -= ((new Date(dayMs).getUTCDay() + 6) % 7) * 86_400_000; // this Monday
    dayMs += 7 * 86_400_000; // next Monday
  }
  return new Date(dayMs - IST_OFFSET_MS);
}

function ResetCountdown({ window }: { window: LeaderboardWindow }) {
  const t = useTranslations("topluluk");
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const label = useMemo(() => {
    const next = nextResetIst(window, now);
    if (!next) return null;
    const ms = next.getTime() - now.getTime();
    if (ms <= 0) return t("rank_reset_soon");
    const totalMinutes = Math.floor(ms / 60_000);
    const days = Math.floor(totalMinutes / (60 * 24));
    const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
    const minutes = totalMinutes % 60;
    const time =
      days >= 1 ? t("rank_reset_dh", { days, hours }) : t("rank_reset_hm", { hours, minutes });
    return t("rank_reset", { time });
  }, [now, t, window]);

  if (!label) return null;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-medium"
      style={{ background: "#f5f5f5", color: "var(--color-secondary)" }}
    >
      <Clock size={13} aria-hidden="true" />
      {label}
    </span>
  );
}

/** Positive-only framing — never shames a low rank (guardrail §4). */
function EncouragingBanner({ me, total }: { me: LeaderboardEntry | null; total: number }) {
  const t = useTranslations("topluluk");
  const locale = useLocale();
  // "Ahead of X%" only when it stays positive (≥1%); otherwise a warm generic nudge — never "0%".
  const pct = me && total > 1 ? Math.round(((total - me.rank) / total) * 100) : 0;
  const text = !me
    ? t("rank_banner_first")
    : me.rank === 1
      ? t("rank_banner_top1")
      : me.rank <= 3
        ? t("rank_banner_top3")
        : pct >= 1
          ? t("rank_percentile", { pct })
          : t("rank_banner_keep", { xp: me.xp.toLocaleString(locale) });

  return (
    <div
      className="rounded-2xl px-4 py-3 text-[14px] font-medium"
      style={{
        background: "color-mix(in srgb, var(--color-chip) 14%, white)",
        color: "var(--color-main)",
      }}
    >
      {text}
    </div>
  );
}

function PodiumSpot({
  entry,
  place,
  youLabel,
  reduce,
}: {
  entry: LeaderboardEntry;
  place: 0 | 1 | 2;
  youLabel: string;
  reduce: boolean;
}) {
  const locale = useLocale();
  const first = place === 0;
  const size = first ? 76 : 60;
  const pedH = first ? 58 : place === 1 ? 42 : 34; // stepped pedestal heights (winner tallest)
  const name = entry.isMe ? youLabel : entry.displayName;
  const xpCount = useCountUp(entry.xp, reduce);

  return (
    <motion.div
      className="flex min-w-0 flex-1 flex-col items-center"
      style={{ order: place === 0 ? 2 : place === 1 ? 1 : 3 }}
      initial={reduce ? false : { opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 + place * 0.08, duration: 0.4, ease: "easeOut" }}
    >
      <div className="relative">
        {first && (
          <Crown
            size={22}
            aria-hidden="true"
            className="absolute -top-5 left-1/2 -translate-x-1/2"
            style={{ color: MEDAL[0], fill: MEDAL[0] }}
          />
        )}
        <span
          className="block rounded-full p-[3px]"
          style={{ background: `linear-gradient(145deg, ${MEDAL[place]}, color-mix(in srgb, ${MEDAL[place]} 40%, white))` }}
        >
          <span className="block rounded-full bg-white p-[2px]">
            <AuthorAvatar name={name} size={size} src={entry.avatarUrl ?? undefined} />
          </span>
        </span>
      </div>
      <p
        className="mt-3 w-full truncate text-center text-[13px] font-semibold"
        style={{ color: "var(--color-main)" }}
        title={name}
      >
        {name}
      </p>
      <span className="flex items-center justify-center">
        <MovementIndicator movement={entry.movement} />
      </span>
      <p className="mb-2 text-[13px] font-bold tabular-nums" style={{ color: "var(--color-main)" }}>
        {xpCount.toLocaleString(locale)}
        <span className="ml-0.5 text-[10px] font-normal" style={{ color: "var(--color-secondary)" }}>
          XP
        </span>
      </p>
      {/* Pedestal step — big rank numeral, winner tallest; grows up on entrance (calm, no neon). */}
      <motion.div
        className="mt-auto flex w-full items-start justify-center rounded-t-lg pt-1.5"
        style={{
          height: pedH,
          transformOrigin: "bottom",
          background: `linear-gradient(to bottom, color-mix(in srgb, ${MEDAL[place]} 24%, white), color-mix(in srgb, ${MEDAL[place]} 6%, white))`,
        }}
        initial={reduce ? false : { scaleY: 0, opacity: 0 }}
        animate={{ scaleY: 1, opacity: 1 }}
        transition={{ delay: 0.18 + place * 0.08, duration: 0.4, ease: "easeOut" }}
      >
        <span
          className="text-[22px] font-black leading-none"
          style={{ color: MEDAL[place], fontFamily: "var(--font-heading)" }}
        >
          {entry.rank}
        </span>
      </motion.div>
    </motion.div>
  );
}

function StandingCard({ me, youLabel, reduce }: { me: LeaderboardEntry; youLabel: string; reduce: boolean }) {
  const t = useTranslations("topluluk");
  const locale = useLocale();
  const xpCount = useCountUp(me.xp, reduce);
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[13px] font-semibold" style={{ color: "var(--color-secondary)" }}>
        {t("rank_you_standing")}
      </p>
      <div
        className="flex items-center gap-3 rounded-2xl px-4 py-3"
        style={{
          background: "color-mix(in srgb, var(--color-accent) 10%, white)",
          border: "1px solid color-mix(in srgb, var(--color-accent) 28%, transparent)",
        }}
      >
        <span className="inline-flex items-center gap-0.5 text-[18px] font-bold" style={{ color: "var(--color-accent)" }}>
          #{me.rank}
          <MovementIndicator movement={me.movement} />
        </span>
        <AuthorAvatar name={youLabel} size={40} src={me.avatarUrl ?? undefined} />
        <span className="min-w-0 flex-1 truncate text-[14px] font-bold" style={{ color: "var(--color-main)" }}>
          {youLabel}
        </span>
        <span className="text-[15px] font-bold tabular-nums" style={{ color: "var(--color-main)" }}>
          {xpCount.toLocaleString(locale)}
          <span className="ml-0.5 text-[11px] font-normal" style={{ color: "var(--color-secondary)" }}>
            XP
          </span>
        </span>
      </div>
    </div>
  );
}

function ListRow({ entry, youLabel, index, reduce }: { entry: LeaderboardEntry; youLabel: string; index: number; reduce: boolean }) {
  const locale = useLocale();
  const name = entry.isMe ? youLabel : entry.displayName;
  const xpCount = useCountUp(entry.xp, reduce);
  return (
    <motion.div
      className="flex items-center gap-3 rounded-xl px-3 py-2"
      style={entry.isMe ? { background: "color-mix(in srgb, var(--color-accent) 10%, white)" } : undefined}
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 + index * 0.04, duration: 0.3, ease: "easeOut" }}
    >
      <div className="flex w-6 flex-col items-center gap-0.5">
        <span
          className="text-[13px] font-bold tabular-nums"
          style={{ color: entry.isMe ? "var(--color-accent)" : "var(--color-secondary)" }}
        >
          {entry.rank}
        </span>
        <MovementIndicator movement={entry.movement} />
      </div>
      <AuthorAvatar name={name} size={32} src={entry.avatarUrl ?? undefined} />
      <span
        className="min-w-0 flex-1 truncate text-[14px]"
        style={{ color: "var(--color-main)", fontWeight: entry.isMe ? 700 : 400 }}
      >
        {name}
      </span>
      <span className="text-[14px] font-bold tabular-nums" style={{ color: "var(--color-main)" }}>
        {xpCount.toLocaleString(locale)}
        <span className="ml-0.5 text-[11px] font-normal" style={{ color: "var(--color-secondary)" }}>
          XP
        </span>
      </span>
    </motion.div>
  );
}

const WINDOW_LABEL = { today: "rank_today", weekly: "rank_weekly", all_time: "rank_alltime" } as const;

/** Segmented time-window switch: Bugün / Hafta / Tüm zamanlar. */
function WindowTabs({
  value,
  onChange,
}: {
  value: LeaderboardWindow;
  onChange: (w: LeaderboardWindow) => void;
}) {
  const t = useTranslations("topluluk");
  const reduce = useReducedMotion() ?? false;
  return (
    <div
      role="tablist"
      aria-label={t("rank_window_label")}
      className="flex gap-1 rounded-full p-1"
      style={{ background: "#f5f5f5" }}
    >
      {(["today", "weekly", "all_time"] as const).map((w) => {
        const active = w === value;
        return (
          <button
            key={w}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(w)}
            className="relative flex-1 rounded-full py-2.5 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
            style={{ color: active ? "var(--color-main)" : "var(--color-secondary)" }}
          >
            {/* Sliding white pill tracks the active tab (crossfade under reduced motion). */}
            {active &&
              (reduce ? (
                <span
                  className="absolute inset-0 rounded-full"
                  style={{ background: "white", boxShadow: "var(--shadow-card)" }}
                />
              ) : (
                <motion.span
                  layoutId="rankTabPill"
                  className="absolute inset-0 rounded-full"
                  style={{ background: "white", boxShadow: "var(--shadow-card)" }}
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              ))}
            <span className="relative z-[1]">{t(WINDOW_LABEL[w])}</span>
          </button>
        );
      })}
    </div>
  );
}

export function LeaderboardScreen() {
  const t = useTranslations("topluluk");
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
        const wk = res.leaderboard; // seed the weekly board so switching to it never refetches
        if (wk) setBoards((b) => ({ ...b, weekly: wk }));
      })
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, []);

  // Fetch the active window's board on demand (weekly comes pre-seeded from the summary).
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
  const podium = board?.items.slice(0, 3) ?? [];
  const rest = board?.items.slice(3) ?? [];
  const me = board?.me ?? null;
  const meOnPodium = me !== null && podium.some((e) => e.isMe);

  return (
    <div className="mx-auto w-full max-w-md px-4 pb-10 pt-4">
      {/* Header */}
      <div className="mb-4 flex items-center gap-3">
        <Link
          href="/topluluk"
          aria-label={t("rank_back")}
          className="flex h-11 w-11 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
          style={{ color: "var(--color-main)", background: "#f5f5f5" }}
        >
          <ArrowLeft size={18} aria-hidden="true" />
        </Link>
        <h1
          className="flex-1 text-[20px] font-bold"
          style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
        >
          {t("rank_page_title")}
        </h1>
        {economyOn && <ResetCountdown window={activeWindow} />}
      </div>

      {failed ? (
        <p className="py-10 text-center text-[14px]" style={{ color: "var(--color-secondary)" }}>
          {t("error")}
        </p>
      ) : data === null ? (
        <SkeletonGroup label={t("loading")} className="flex flex-col gap-4">
          <Skeleton className="h-[52px] w-full rounded-2xl" />
          <Skeleton className="h-[180px] w-full rounded-2xl" />
          <Skeleton className="h-[220px] w-full rounded-2xl" />
        </SkeletonGroup>
      ) : !economyOn ? (
        <p className="py-10 text-center text-[14px]" style={{ color: "var(--color-secondary)" }}>
          {t("leaderboard_empty")}
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          <WindowTabs value={activeWindow} onChange={setActiveWindow} />

          <motion.div
            key={activeWindow}
            className="flex flex-col gap-6"
            initial={reduce ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
          {board === null ? (
            failedWindows.has(activeWindow) ? (
              <div className="flex flex-col items-center gap-3 py-8">
                <p className="text-[14px]" style={{ color: "var(--color-secondary)" }}>
                  {t("error")}
                </p>
                <button
                  type="button"
                  onClick={() =>
                    setFailedWindows((s) => {
                      const next = new Set(s);
                      next.delete(activeWindow);
                      return next;
                    })
                  }
                  className="rounded-full px-4 py-2 text-[13px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
                  style={{ background: "#f5f5f5", color: "var(--color-main)" }}
                >
                  {t("refresh")}
                </button>
              </div>
            ) : (
              <SkeletonGroup label={t("loading")} className="flex flex-col gap-4">
                <Skeleton className="h-[52px] w-full rounded-2xl" />
                <Skeleton className="h-[180px] w-full rounded-2xl" />
                <Skeleton className="h-[160px] w-full rounded-2xl" />
              </SkeletonGroup>
            )
          ) : board.items.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <span
                className="flex h-14 w-14 items-center justify-center rounded-full"
                style={{ background: "color-mix(in srgb, var(--color-chip) 16%, white)" }}
              >
                <Trophy size={24} aria-hidden="true" style={{ color: MEDAL[0] }} />
              </span>
              <p className="max-w-[240px] text-[14px]" style={{ color: "var(--color-secondary)" }}>
                {t("leaderboard_empty")}
              </p>
            </div>
          ) : (
            <>
              <EncouragingBanner me={me} total={board.totalParticipants} />

              <div className="relative overflow-hidden rounded-3xl px-4 pb-6 pt-8">
                {/* AI-generated podium atmosphere (public/leaderboard/podium-bg.png). */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 bg-cover bg-top"
                  style={{ backgroundImage: "url(/leaderboard/podium-bg.png)" }}
                />
                {/* Feather to the calm white canvas so the image never overpowers the light theme. */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background:
                      "radial-gradient(120% 90% at 50% 0%, transparent 0%, transparent 42%, color-mix(in srgb, white 82%, transparent) 78%, white 100%)",
                  }}
                />
                <div className="relative flex items-end justify-center gap-2">
                  {podium.map((entry, i) => (
                    <PodiumSpot
                      key={entry.userId}
                      entry={entry}
                      place={i as 0 | 1 | 2}
                      youLabel={t("leaderboard_you")}
                      reduce={reduce}
                    />
                  ))}
                </div>
              </div>

              {me !== null && !meOnPodium && (
            <StandingCard me={me} youLabel={t("leaderboard_you")} reduce={reduce} />
          )}
              {me === null && (
                <p className="text-[13px]" style={{ color: "var(--color-secondary)" }}>
                  {t("leaderboard_you_none")}
                </p>
              )}

              {rest.length > 0 && (
                <div className="flex flex-col gap-1">
                  <p
                    className="mb-1 text-[15px] font-bold"
                    style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
                  >
                    {t("rank_list_title")}
                  </p>
                  {rest.map((entry, i) => (
                    <ListRow
                      key={entry.userId}
                      entry={entry}
                      index={i}
                      youLabel={t("leaderboard_you")}
                      reduce={reduce}
                    />
                  ))}
                </div>
              )}
            </>
          )}
          </motion.div>

          {/* Badges only — streak/XP live on the profile/panel, not repeated on the ranking page. */}
          {data.badges.length > 0 && (
            <div className="border-t pt-5" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
              <BadgeStrip badges={data.badges} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
