import { useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { ApiClientError } from "@mentor/api-client";
import type { CommunityBadgeId, LeaderboardWindow } from "@mentor/types";
import { CupStarIcon } from "@solar-icons/react-native/linear/cup-star";
import { useQuery } from "@tanstack/react-query";
import {
  fetchCommunityLeaderboard,
  fetchCommunitySummary,
} from "../../lib/community-api.js";
import { formatLeagueResetParts } from "../../lib/community-view.js";
import { useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { PanelCard } from "../panel/primitives.js";
import {
  AppText,
  Chip,
  ScreenLoadingSkeleton,
  SlidingTabs,
  StateView,
} from "../ui/index.js";
import { CommunityAvatar } from "./community-avatar.js";

function badgeLabelKey(id: CommunityBadgeId) {
  if (id === "marathon") return "badge_marathon" as const;
  if (id === "night_owl") return "badge_night_owl" as const;
  if (id === "motivator") return "badge_motivator" as const;
  return "badge_newcomer" as const;
}

export function LeaderboardView() {
  const { palette, radii } = useThemeTokens();
  const t = useTranslations("community");
  const [windowKey, setWindowKey] = useState<LeaderboardWindow>("weekly");
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const leaderboardQuery = useQuery({
    queryKey: ["community", "leaderboard", windowKey],
    queryFn: () => fetchCommunityLeaderboard(windowKey),
  });

  const summaryQuery = useQuery({
    queryKey: ["community", "summary"],
    queryFn: fetchCommunitySummary,
    staleTime: 60_000,
  });

  const resetLabel = useMemo(() => {
    const parts = formatLeagueResetParts(windowKey, now);
    if (!parts) return null;
    if (parts.days === 0 && parts.hours === 0 && parts.minutes === 0) {
      return t("rank_reset_soon");
    }
    const time =
      parts.days > 0
        ? t("rank_reset_dh", { days: parts.days, hours: parts.hours })
        : t("rank_reset_hm", { hours: parts.hours, minutes: parts.minutes });
    return t("rank_reset", { time });
  }, [now, t, windowKey]);

  const data = leaderboardQuery.data;
  const summary = summaryQuery.data;

  return (
    <View style={styles.root}>
      <PanelCard style={styles.heroCard}>
        <View style={styles.heroHeader}>
          <CupStarIcon size={24} color={palette.playSelectedInk} strokeWidth={1.75} />
          <AppText variant="cardTitle" style={{ flex: 1 }}>
            {t("league_title")}
          </AppText>
        </View>
        <AppText variant="body" tone="secondary">
          {t("league_subtitle")}
        </AppText>
        {resetLabel ? (
          <AppText variant="caption" style={{ color: palette.playSelectedInk, fontWeight: "700" }}>
            {resetLabel}
          </AppText>
        ) : null}
      </PanelCard>

      <SlidingTabs
        variant="pill"
        compact
        accessibilityLabel={t("league_title")}
        value={windowKey}
        onChange={setWindowKey}
        items={[
          { id: "today", label: t("window_today") },
          { id: "weekly", label: t("window_weekly") },
          { id: "all_time", label: t("window_all_time") },
        ]}
      />

      {summary && summary.badges.length > 0 ? (
        <PanelCard style={styles.badgesCard}>
          <AppText variant="micro" tone="muted">
            {t("badges_title")}
          </AppText>
          <View style={styles.chipsWrap}>
            {summary.badges.map((badge) => (
              <Chip key={badge} label={t(badgeLabelKey(badge))} tone="coach" />
            ))}
          </View>
        </PanelCard>
      ) : null}

      {leaderboardQuery.isLoading ? (
        <ScreenLoadingSkeleton />
      ) : leaderboardQuery.isError ? (
        <StateView
          tone="error"
          title={t("error_title")}
          body={
            leaderboardQuery.error instanceof ApiClientError
              ? leaderboardQuery.error.message
              : t("league_empty")
          }
          actionLabel={t("retry")}
          onAction={() => void leaderboardQuery.refetch()}
        />
      ) : !data || data.items.length === 0 ? (
        <StateView title={t("league_title")} body={t("league_empty")} />
      ) : (
        <View style={styles.list}>
          {data.me ? (
            <PanelCard
              style={[
                styles.meCard,
                { borderColor: palette.ctaPlayEdge, backgroundColor: palette.playSelected },
              ]}
            >
              <View style={styles.meTop}>
                <AppText style={{ color: palette.playSelectedInk, fontWeight: "800" }}>
                  {t("rank_you_standing", { rank: data.me.rank })}
                </AppText>
                <AppText tabularNums style={{ color: palette.playSelectedInk, fontWeight: "800" }}>
                  {t("xp_label", { xp: data.me.xp })}
                </AppText>
              </View>
              <AppText variant="caption" style={{ color: palette.playSelectedInk }}>
                {t("rank_percentile")}
              </AppText>
            </PanelCard>
          ) : null}

          <AppText variant="caption" tone="secondary" tabularNums>
            {t("participants_count", { count: data.totalParticipants })}
          </AppText>

          {data.items.map((entry) => {
            const movementChip =
              entry.movement === "up"
                ? { label: t("movement_up"), tone: "success" as const }
                : entry.movement === "new"
                  ? { label: t("movement_new"), tone: "coach" as const }
                  : entry.movement === "down"
                    ? { label: t("movement_down"), tone: "default" as const }
                    : entry.movement === "same"
                      ? { label: t("movement_same"), tone: "default" as const }
                      : null;

            return (
              <View
                key={entry.userId}
                style={[
                  styles.row,
                  {
                    backgroundColor: entry.isMe ? palette.playSelected : palette.surface,
                    borderColor: entry.isMe ? palette.ctaPlayEdge : palette.border,
                    borderRadius: radii.inner,
                  },
                ]}
              >
                <AppText tabularNums style={[styles.rankNum, entry.isMe && { color: palette.playSelectedInk }]}>
                  {`#${entry.rank}`}
                </AppText>
                <CommunityAvatar name={entry.displayName} avatarUrl={entry.avatarUrl} size={34} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <AppText numberOfLines={1} style={{ fontWeight: entry.isMe ? "800" : "700" }}>
                    {entry.displayName}
                  </AppText>
                </View>
                {movementChip ? <Chip label={movementChip.label} tone={movementChip.tone} /> : null}
                <AppText tabularNums style={{ fontWeight: "800" }}>
                  {t("xp_label", { xp: entry.xp })}
                </AppText>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 12 },
  heroCard: { gap: 6 },
  heroHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  badgesCard: { gap: 8 },
  chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  list: { gap: 8 },
  meCard: { gap: 4 },
  meTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  row: {
    minHeight: 54,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  rankNum: { width: 32, fontWeight: "800", fontSize: 14 },
});
