"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { CommunitySummary } from "@mentor/types";
import { Skeleton, SkeletonGroup } from "@mentor/ui";
import { getCommunitySummary } from "@/lib/community";
import { ProfileCard } from "./profile-card";
import { StatSnapshot } from "./stat-snapshot";
import { BadgeStrip } from "./badge-strip";
import { MiniLeaderboard } from "./mini-leaderboard";

/**
 * Right-column effort board ("Emek Panosu") — identity (ProfileCard) + streak/XP snapshot + badges +
 * weekly effort leaderboard. One fetch feeds it all. If the fetch fails the identity card still stands
 * (the board is additive, never a blocker); economy-off degrades via the null fields in the payload.
 */
export function EffortBoard() {
  const t = useTranslations("topluluk");
  const [data, setData] = useState<CommunitySummary | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    getCommunitySummary()
      .then((res) => active && setData(res))
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <ProfileCard />

      {failed ? null : data === null ? (
        <SkeletonGroup label={t("loading")} className="flex flex-col gap-4">
          <Skeleton className="h-[72px] w-full rounded-xl" />
          <Skeleton className="h-[120px] w-full rounded-xl" />
        </SkeletonGroup>
      ) : (
        <>
          <StatSnapshot streak={data.streak} xp={data.xp} level={data.level} />
          {data.badges.length > 0 && <BadgeStrip badges={data.badges} />}
          {data.leaderboard && <MiniLeaderboard leaderboard={data.leaderboard} />}
        </>
      )}
    </div>
  );
}
