import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import type { CommunitySummary, LeaderboardWindow } from "@mentor/types";
import { fetchCommunityLeaderboard } from "../../lib/community-api.js";
import { haptics } from "../../lib/haptics.js";
import { useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { AppText, Card, Chip } from "../ui/index.js";

export interface LeaderboardViewProps {
  summary: CommunitySummary | null;
}

const WINDOWS: LeaderboardWindow[] = ["weekly", "today", "all_time"];

export function LeaderboardSectionView({ summary }: LeaderboardViewProps) {
  const t = useTranslations("community");
  const { palette, radii, space } = useThemeTokens();
  const [window, setWindow] = useState<LeaderboardWindow>("weekly");

  const boardQuery = useQuery({
    queryKey: ["community-leaderboard", window],
    queryFn: () => fetchCommunityLeaderboard(window),
  });

  const board = boardQuery.data ?? summary?.leaderboard ?? null;

  return (
    <View style={{ gap: space.md }}>
      <Card style={{ gap: space.sm }}>
        <AppText variant="sectionHeading">{t("league_title")}</AppText>
        <AppText variant="body" tone="secondary">
          {t("league_subtitle")}
        </AppText>
        <View style={styles.chipRow}>
          {WINDOWS.map((item) => (
            <Chip
              key={item}
              label={t(`window_${item}` as "window_weekly")}
              selected={window === item}
              onPress={() => {
                void haptics.selection();
                setWindow(item);
              }}
            />
          ))}
        </View>
      </Card>

      {board?.me ? (
        <Card
          style={{
            gap: space.xs,
            borderColor: palette.accent,
            backgroundColor: palette.surfaceAlt,
          }}
        >
          <View style={styles.rowBetween}>
            <AppText variant="cardTitle" tone="accent">
              #{board.me.rank} · {t("your_rank_title")}
            </AppText>
            <AppText variant="cardTitle" tone="accent" tabularNums>
              {t("xp_label", { xp: board.me.xp })}
            </AppText>
          </View>
          {board.me.movement === "up" ? (
            <AppText variant="caption" tone="success">
              {t("movement_up")}
            </AppText>
          ) : board.me.movement === "new" ? (
            <AppText variant="caption" tone="accent">
              {t("movement_new")}
            </AppText>
          ) : null}
        </Card>
      ) : null}

      <Card style={{ gap: space.sm }}>
        {board ? (
          <AppText variant="caption" tone="secondary">
            {t("participants_count", { count: board.totalParticipants })}
          </AppText>
        ) : null}

        {!board || board.items.length === 0 ? (
          <AppText variant="body" tone="secondary">
            {t("league_empty")}
          </AppText>
        ) : (
          <View style={{ gap: space.xs }}>
            {board.items.map((entry) => (
              <View
                key={entry.userId}
                style={[
                  styles.entryRow,
                  {
                    padding: space.sm,
                    borderRadius: radii.card,
                    backgroundColor: entry.isMe
                      ? palette.surfaceHover
                      : palette.surfaceAlt,
                    borderColor: entry.isMe ? palette.accent : palette.border,
                  },
                ]}
              >
                <View style={styles.row}>
                  <AppText variant="cardTitle" tabularNums style={styles.rank}>
                    #{entry.rank}
                  </AppText>
                  <AppText variant="cardTitle">{entry.displayName}</AppText>
                </View>
                <AppText variant="body" tone="accent" tabularNums>
                  {t("xp_label", { xp: entry.xp })}
                </AppText>
              </View>
            ))}
          </View>
        )}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  entryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
  },
  rank: { minWidth: 32 },
});
