import { useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { ForumZonesView } from "../../../components/community/forum-zones-view.js";
import { LeaderboardSectionView } from "../../../components/community/leaderboard-view.js";
import { StudyRoomsView } from "../../../components/community/study-rooms-view.js";
import { AppText, Chip, Skeleton } from "../../../components/ui/index.js";
import {
  fetchCommunitySummary,
  listForumZones,
  listStudyRooms,
} from "../../../lib/community-api.js";
import { haptics } from "../../../lib/haptics.js";
import { useTranslations } from "../../../providers/i18n-provider.js";
import { useThemeTokens } from "../../../providers/theme-provider.js";

type CommunityTab = "rooms" | "forum" | "league";

export default function CommunityScreen() {
  const t = useTranslations("community");
  const insets = useSafeAreaInsets();
  const { palette, space } = useThemeTokens();
  const [activeTab, setActiveTab] = useState<CommunityTab>("rooms");

  const roomsQuery = useQuery({
    queryKey: ["study-rooms"],
    queryFn: listStudyRooms,
  });

  const zonesQuery = useQuery({
    queryKey: ["forum-zones"],
    queryFn: listForumZones,
  });

  const summaryQuery = useQuery({
    queryKey: ["community-summary"],
    queryFn: fetchCommunitySummary,
  });

  const isLoading = roomsQuery.isLoading && zonesQuery.isLoading;
  const isRefreshing =
    roomsQuery.isRefetching ||
    zonesQuery.isRefetching ||
    summaryQuery.isRefetching;

  const handleRefresh = () => {
    void Promise.all([
      roomsQuery.refetch(),
      zonesQuery.refetch(),
      summaryQuery.refetch(),
    ]);
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: palette.bg }}
      contentContainerStyle={{
        paddingTop: insets.top + space.lg,
        paddingHorizontal: space.lg,
        paddingBottom: space.xl,
        gap: space.md,
      }}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          tintColor={palette.accent}
        />
      }
    >
      <View style={{ gap: 4 }}>
        <AppText variant="title">{t("title")}</AppText>
        <AppText variant="body" tone="secondary">
          {t("subtitle")}
        </AppText>
      </View>

      <View style={styles.tabRow}>
        <Chip
          label={t("tab_rooms")}
          selected={activeTab === "rooms"}
          onPress={() => {
            void haptics.selection();
            setActiveTab("rooms");
          }}
        />
        <Chip
          label={t("tab_forum")}
          selected={activeTab === "forum"}
          onPress={() => {
            void haptics.selection();
            setActiveTab("forum");
          }}
        />
        <Chip
          label={t("tab_league")}
          selected={activeTab === "league"}
          onPress={() => {
            void haptics.selection();
            setActiveTab("league");
          }}
        />
      </View>

      {isLoading ? (
        <View style={{ gap: space.sm }}>
          <Skeleton height={120} />
          <Skeleton height={180} />
        </View>
      ) : activeTab === "rooms" ? (
        <StudyRoomsView rooms={roomsQuery.data ?? []} />
      ) : activeTab === "forum" ? (
        <ForumZonesView zones={zonesQuery.data ?? []} />
      ) : (
        <LeaderboardSectionView summary={summaryQuery.data ?? null} />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  tabRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
