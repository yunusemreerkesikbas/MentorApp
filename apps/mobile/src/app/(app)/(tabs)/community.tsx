import { useCallback, useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BookmarkIcon } from "@solar-icons/react-native/linear/bookmark";
import { MagnifierIcon } from "@solar-icons/react-native/linear/magnifier";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CommunityComposerSheet,
  type ComposerMode,
} from "../../../components/community/community-composer-sheet.js";
import { CommunityFeedView } from "../../../components/community/community-feed-view.js";
import { CommunityHubView } from "../../../components/community/community-hub-view.js";
import { ForumZonesView } from "../../../components/community/forum-zones-view.js";
import { LeaderboardView } from "../../../components/community/leaderboard-view.js";
import { SessionRoomsCard } from "../../../components/session/session-rooms-card.js";
import { SessionStage } from "../../../components/session/session-stage.js";
import { AppText, SlidingTabs, StateView } from "../../../components/ui/index.js";
import type { CommunityPostModel } from "../../../lib/community-view.js";
import { listForumZones } from "../../../lib/forum-api.js";
import { haptics } from "../../../lib/haptics.js";
import { tabBarClearance } from "../../../lib/layout.js";
import { useAppAvailability } from "../../../providers/availability-provider.js";
import { useTranslations } from "../../../providers/i18n-provider.js";
import { useThemeTokens } from "../../../providers/theme-provider.js";

type CommunityTab = "hub" | "feed" | "forum" | "rooms" | "league";

const VALID_TABS = new Set<CommunityTab>(["hub", "feed", "forum", "rooms", "league"]);

export default function CommunityScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ tab?: string; zoneSlug?: string; tag?: string }>();
  const { availability } = useAppAvailability();
  const { palette, space } = useThemeTokens();
  const t = useTranslations("community");

  const [tab, setTab] = useState<CommunityTab>(() =>
    params.tab && VALID_TABS.has(params.tab as CommunityTab)
      ? (params.tab as CommunityTab)
      : "hub",
  );
  const [selectedTag, setSelectedTag] = useState<string | null>(params.tag ?? null);
  const [selectedZoneSlug, setSelectedZoneSlug] = useState<string | null>(
    params.zoneSlug ?? null,
  );
  const [refreshing, setRefreshing] = useState(false);

  const [composerOpen, setComposerOpen] = useState(false);
  const [composerMode, setComposerMode] = useState<ComposerMode>("CHAT");
  const [composerZoneId, setComposerZoneId] = useState<string | null>(null);

  useEffect(() => {
    if (params.tab && VALID_TABS.has(params.tab as CommunityTab)) {
      setTab(params.tab as CommunityTab);
    }
    if (params.zoneSlug) {
      setSelectedZoneSlug(params.zoneSlug);
      setTab("forum");
    }
    if (params.tag) {
      setSelectedTag(params.tag);
      setTab("feed");
    }
  }, [params.tab, params.tag, params.zoneSlug]);

  const zonesQuery = useQuery({
    queryKey: ["forum", "zones"],
    queryFn: listForumZones,
    enabled: availability.forum,
  });

  const handleOpenComposer = useCallback(
    (mode: ComposerMode, zoneId: string | null = null) => {
      haptics.selection();
      setComposerMode(mode);
      setComposerZoneId(zoneId);
      setComposerOpen(true);
    },
    [],
  );

  const handleOpenThread = useCallback(
    (post: CommunityPostModel) => {
      router.push({
        pathname: "/(app)/community-thread",
        params: {
          id: post.id,
          kind: post.zone.type === "QA" ? "question" : "thread",
        },
      });
    },
    [router],
  );

  const handleOpenMember = useCallback(
    (username: string) => {
      router.push({ pathname: "/(app)/community-member", params: { username } });
    },
    [router],
  );

  const handleOpenZone = useCallback((slug: string) => {
    setSelectedZoneSlug(slug);
    setTab("forum");
  }, []);

  const handleOpenFeedWithTag = useCallback((slug: string) => {
    setSelectedTag(slug);
    setTab("feed");
  }, []);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["forum"] }),
        queryClient.invalidateQueries({ queryKey: ["community"] }),
        queryClient.invalidateQueries({ queryKey: ["study-rooms"] }),
        queryClient.invalidateQueries({ queryKey: ["coaching", "focusing"] }),
      ]);
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <View style={[styles.screen, { backgroundColor: palette.bg }]}>
      <View
        style={[
          styles.topChrome,
          {
            backgroundColor: palette.surface,
            borderBottomColor: palette.playLine,
          },
        ]}
      >
        <View style={styles.headerBar}>
          <AppText variant="title" accessibilityRole="header" style={{ flex: 1 }} numberOfLines={1}>
            {t("title")}
          </AppText>
          <View style={styles.headerActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("search_cta")}
              onPress={() => router.push("/(app)/community-search")}
              style={styles.iconBtn}
            >
              <MagnifierIcon size={21} color={palette.main} strokeWidth={1.75} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("saved_cta")}
              onPress={() => router.push("/(app)/community-saved")}
              style={styles.iconBtn}
            >
              <BookmarkIcon size={21} color={palette.main} strokeWidth={1.75} />
            </Pressable>
          </View>
        </View>

        <View style={styles.tabsPad}>
          <SlidingTabs
            variant="underline"
            accessibilityLabel={t("title")}
            value={tab}
            onChange={(next) => {
              haptics.selection();
              setTab(next);
            }}
            items={[
              { id: "hub", label: t("tab_hub") },
              { id: "feed", label: t("tab_feed") },
              { id: "forum", label: t("tab_forum") },
              { id: "rooms", label: t("tab_rooms") },
              { id: "league", label: t("tab_league") },
            ]}
          />
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{
          padding: space.md,
          paddingBottom: tabBarClearance(insets.bottom),
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void handleRefresh()}
            tintColor={palette.playSelectedInk}
          />
        }
        keyboardShouldPersistTaps="handled"
      >
        {tab === "hub" ? (
          <CommunityHubView
            onCompose={(mode) => handleOpenComposer(mode)}
            onOpenFeed={() => setTab("feed")}
            onOpenFeedWithTag={handleOpenFeedWithTag}
            onOpenTables={() => setTab("rooms")}
            onOpenZone={handleOpenZone}
            onOpenThread={handleOpenThread}
            onOpenMember={handleOpenMember}
          />
        ) : null}

        {tab === "feed" ? (
          <CommunityFeedView
            selectedTag={selectedTag}
            onClearTag={() => setSelectedTag(null)}
            onSelectTag={handleOpenFeedWithTag}
            onCompose={(mode) => handleOpenComposer(mode)}
            onOpenZone={handleOpenZone}
            onOpenThread={handleOpenThread}
            onOpenMember={handleOpenMember}
          />
        ) : null}

        {tab === "forum" ? (
          <ForumZonesView
            initialSlug={selectedZoneSlug}
            onClearInitialSlug={() => setSelectedZoneSlug(null)}
            onCompose={(mode, zoneId) => handleOpenComposer(mode, zoneId)}
            onOpenThread={handleOpenThread}
            onOpenMember={handleOpenMember}
          />
        ) : null}

        {tab === "rooms" ? (availability.studyRooms ? (
          <SessionStage phase="idle" theme={null}><SessionRoomsCard /></SessionStage>
        ) : <StateView title={t("soon_title")} body={t("soon_desc")} />) : null}

        {tab === "league" ? <LeaderboardView /> : null}
      </ScrollView>

      <CommunityComposerSheet
        visible={composerOpen}
        zones={zonesQuery.data ?? []}
        initialMode={composerMode}
        initialZoneId={composerZoneId}
        onClose={() => setComposerOpen(false)}
        onCreated={(id, mode) =>
          router.push({
            pathname: "/(app)/community-thread",
            params: { id, kind: mode === "QA" ? "question" : "thread" },
          })
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topChrome: { borderBottomWidth: StyleSheet.hairlineWidth },
  headerBar: {
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingLeft: 16,
    paddingRight: 8,
  },
  headerActions: { flexDirection: "row", alignItems: "center" },
  iconBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  tabsPad: { paddingHorizontal: 16 },
  scroll: { flex: 1 },
});
