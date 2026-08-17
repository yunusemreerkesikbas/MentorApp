"use client";
import { ChevronRight, Crown, Trophy } from "lucide-react";

import { useLocale, useTranslations } from "next-intl";
import type { LeaderboardEntry, LeaderboardView } from "@mentor/types";
import { Link } from "@/i18n/navigation";
import { AuthorAvatar } from "./author-avatar";
import { MEDAL } from "./leaderboard-medals";

function Spot({ entry, place, youLabel }: { entry: LeaderboardEntry; place: 0 | 1 | 2; youLabel: string }) {
  const locale = useLocale();
  const first = place === 0;
  const pedH = first ? 34 : place === 1 ? 24 : 18; // compact stepped pedestal (winner tallest)
  const name = entry.isMe ? youLabel : entry.displayName;
  return (
    <div
      className="flex min-w-0 flex-1 flex-col items-center"
      style={{ order: place === 0 ? 2 : place === 1 ? 1 : 3 }}
    >
      <div className="relative">
        {first && (
          <Crown
            size={15}
            aria-hidden="true"
            className="absolute -top-4 left-1/2 -translate-x-1/2"
            style={{ color: MEDAL[0], fill: MEDAL[0] }}
          />
        )}
        <span className="block rounded-full p-[2px]" style={{ background: MEDAL[place] }}>
          <span className="block rounded-full bg-[var(--color-surface)] p-[2px]">
            <AuthorAvatar name={name} size={first ? 52 : 40} src={entry.avatarUrl ?? undefined} />
          </span>
        </span>
      </div>
      <p
        className="mt-2 w-full truncate text-center text-[11px] font-semibold"
        style={{ color: "var(--color-main)" }}
        title={name}
      >
        {name}
      </p>
      <p className="mb-1.5 text-[11px] font-bold tabular-nums" style={{ color: "var(--color-main)" }}>
        {entry.xp.toLocaleString(locale)}
        <span className="ml-0.5 text-[9px] font-normal" style={{ color: "var(--color-secondary)" }}>
          XP
        </span>
      </p>
      {/* Pedestal step with the rank numeral. */}
      <div
        className="mt-auto flex w-full items-start justify-center rounded-t-md pt-1"
        style={{
          height: pedH,
          background: `linear-gradient(to bottom, color-mix(in srgb, ${MEDAL[place]} 22%, white), color-mix(in srgb, ${MEDAL[place]} 6%, white))`,
        }}
      >
        <span
          className="text-[15px] font-black leading-none"
          style={{ color: MEDAL[place], fontFamily: "var(--font-heading)" }}
        >
          {entry.rank}
        </span>
      </div>
    </div>
  );
}

/**
 * Compact effort leaderboard for the right column / drawer — a mini top-3 podium + the viewer's own
 * standing + a "see all" link to the full `/community/leaderboard` screen. XP only (§3).
 */
export function MiniLeaderboard({ leaderboard }: { leaderboard: LeaderboardView }) {
  const t = useTranslations("community");
  const locale = useLocale();
  const podium = leaderboard.items.slice(0, 3);
  const { me } = leaderboard;
  const meOnPodium = me !== null && podium.some((e) => e.isMe);

  return (
    <div className="flex flex-col gap-3 border-t pt-4" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
      <p
        className="flex items-center gap-2 text-[15px] font-bold"
        style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
      >
        <Trophy size={18} aria-hidden="true" style={{ color: MEDAL[2] }} />
        {t("leaderboard_title")}
      </p>

      {podium.length === 0 ? (
        <p className="text-[13px]" style={{ color: "var(--color-secondary)" }}>
          {t("leaderboard_empty")}
        </p>
      ) : (
        <div
          className="rounded-2xl px-3 pb-4 pt-6"
          style={{
            background:
              "radial-gradient(120% 90% at 50% 0%, color-mix(in srgb, var(--color-chip) 16%, white) 0%, white 72%)",
          }}
        >
          <div className="flex items-end justify-center gap-1.5">
            {podium.map((entry, i) => (
              <Spot key={entry.userId} entry={entry} place={i as 0 | 1 | 2} youLabel={t("leaderboard_you")} />
            ))}
          </div>
        </div>
      )}

      {me !== null && !meOnPodium && (
        <div
          className="flex items-center gap-2.5 rounded-xl px-3 py-2"
          style={{
            background: "color-mix(in srgb, var(--color-accent) 10%, white)",
            border: "1px solid color-mix(in srgb, var(--color-accent) 24%, transparent)",
          }}
        >
          <span className="text-[13px] font-bold" style={{ color: "var(--color-accent)" }}>
            #{me.rank}
          </span>
          <AuthorAvatar name={t("leaderboard_you")} size={26} src={me.avatarUrl ?? undefined} />
          <span className="min-w-0 flex-1 truncate text-[13px] font-bold" style={{ color: "var(--color-main)" }}>
            {t("leaderboard_you")}
          </span>
          <span className="text-[13px] font-bold" style={{ color: "var(--color-main)" }}>
            {me.xp.toLocaleString(locale)}
            <span className="ml-0.5 text-[10px] font-normal" style={{ color: "var(--color-secondary)" }}>
              XP
            </span>
          </span>
        </div>
      )}
      {me === null && podium.length > 0 && (
        <p className="text-[12px]" style={{ color: "var(--color-secondary)" }}>
          {t("leaderboard_you_none")}
        </p>
      )}

      <Link
        href="/community/leaderboard"
        className="inline-flex items-center gap-0.5 self-start text-[13px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
        style={{ color: "var(--color-accent)" }}
      >
        {t("rank_see_all")}
        <ChevronRight size={15} aria-hidden="true" />
      </Link>
    </div>
  );
}
