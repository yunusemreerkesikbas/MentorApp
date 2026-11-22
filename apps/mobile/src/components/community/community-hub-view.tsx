import { useState } from "react";
import { Image, Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { ApiClientError } from "@mentor/api-client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { art } from "../../lib/art.js";
import { fetchFocusingNow } from "../../lib/community-api.js";
import { feedItemToPostModel, type CommunityPostModel } from "../../lib/community-view.js";
import { getForumHub, isForumDisabled, joinZone } from "../../lib/forum-api.js";
import { haptics } from "../../lib/haptics.js";
import { useAppAvailability } from "../../providers/availability-provider.js";
import { useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { useToast } from "../../providers/toast-provider.js";
import { LedgeButton, PanelCard } from "../panel/primitives.js";
import { AppText, Button, Chip, ScreenLoadingSkeleton, StateView } from "../ui/index.js";
import { CommunityAvatar } from "./community-avatar.js";
import type { ComposerMode } from "./community-composer-sheet.js";
import { FeedPostCard } from "./feed-post-card.js";

export function CommunityHubView({
  onCompose,
  onOpenFeed,
  onOpenFeedWithTag,
  onOpenTables,
  onOpenZone,
  onOpenThread,
  onOpenMember,
}: {
  onCompose: (mode: ComposerMode) => void;
  onOpenFeed: () => void;
  onOpenFeedWithTag: (slug: string) => void;
  onOpenTables: () => void;
  onOpenZone: (slug: string) => void;
  onOpenThread: (post: CommunityPostModel) => void;
  onOpenMember: (username: string) => void;
}) {
  const queryClient = useQueryClient();
  const { availability } = useAppAvailability();
  const { width } = useWindowDimensions();
  const { palette, radii } = useThemeTokens();
  const stackHeroActions = width < 390;
  const t = useTranslations("community");
  const toast = useToast();
  const [joiningZoneId, setJoiningZoneId] = useState<string | null>(null);

  const hubQuery = useQuery({
    queryKey: ["forum", "hub"],
    queryFn: getForumHub,
    enabled: availability.forum,
  });

  const focusingQuery = useQuery({
    queryKey: ["coaching", "focusing"],
    queryFn: fetchFocusingNow,
    staleTime: 30_000,
  });

  async function handleQuickJoin(zoneId: string) {
    setJoiningZoneId(zoneId);
    haptics.selection();
    try {
      await joinZone(zoneId);
      await queryClient.invalidateQueries({ queryKey: ["forum"] });
    } catch (err) {
      toast.show(err instanceof ApiClientError ? err.message : t("error_title"));
    } finally {
      setJoiningZoneId(null);
    }
  }

  if (!availability.forum || isForumDisabled(hubQuery.error)) {
    return (
      <PanelCard style={styles.disabledCard}>
        <Image source={art.puhuDefault} style={styles.disabledMascot} resizeMode="contain" />
        <AppText variant="cardTitle">{t("soon_title")}</AppText>
        <AppText variant="body" tone="secondary" style={styles.centeredText}>
          {t("soon_desc")}
        </AppText>
      </PanelCard>
    );
  }

  if (hubQuery.isLoading) {
    return <ScreenLoadingSkeleton />;
  }

  if (hubQuery.isError || !hubQuery.data) {
    return (
      <StateView
        tone="error"
        title={t("error_title")}
        body={hubQuery.error instanceof ApiClientError ? hubQuery.error.message : t("soon_desc")}
        actionLabel={t("retry")}
        onAction={() => void hubQuery.refetch()}
      />
    );
  }

  const hub = hubQuery.data;
  const focusingNow = focusingQuery.data ?? 0;

  return (
    <View style={styles.root}>
      <PanelCard style={styles.heroCard}>
        <View style={styles.heroTop}>
          <Image source={art.puhuEncouraging} style={styles.mascot} resizeMode="contain" />
          <View
            style={[
              styles.bubble,
              {
                backgroundColor: palette.surfaceAlt,
                borderColor: palette.playLine,
                borderRadius: radii.inner,
              },
            ]}
          >
            <AppText variant="body">{t("hub_bubble")}</AppText>
          </View>
        </View>

        <AppText variant="title">{t("hub_prompt")}</AppText>

        <View style={[styles.heroActions, stackHeroActions && styles.heroActionsStacked]}>
          <View style={!stackHeroActions ? styles.primaryWrap : undefined}>
            <LedgeButton accessibilityLabel={t("hub_share")} onPress={() => onCompose("CHAT")}>
              {(ink) => (
                <AppText style={[styles.ledgeText, { color: ink }]} numberOfLines={1}>
                  {t("hub_share")}
                </AppText>
              )}
            </LedgeButton>
          </View>
          <Button label={t("hub_ask")} onPress={() => onCompose("QA")} variant="secondary" />
        </View>

        {focusingNow > 0 ? (
          <Pressable
            accessibilityRole="button"
            onPress={onOpenTables}
            style={[
              styles.focusStrip,
              {
                backgroundColor: palette.playSelected,
                borderColor: palette.ctaPlayEdge,
                borderRadius: radii.inner,
              },
            ]}
          >
            <AppText
              variant="caption"
              style={{ color: palette.playSelectedInk, fontWeight: "800", flex: 1 }}
            >
              {t("hub_focusing_now", { count: focusingNow })}
            </AppText>
            <AppText variant="caption" style={{ color: palette.playSelectedInk, fontWeight: "800" }}>
              {t("hub_join_table")}
            </AppText>
          </Pressable>
        ) : null}
      </PanelCard>

      {hub.featured ? (
        <View style={styles.section}>
          <AppText variant="micro" tone="muted">
            {t("hub_featured_eyebrow")}
          </AppText>
          <FeedPostCard
            post={feedItemToPostModel(hub.featured)}
            onOpenThread={onOpenThread}
            onOpenMember={onOpenMember}
            onOpenZone={onOpenZone}
            onSelectTag={onOpenFeedWithTag}
          />
        </View>
      ) : null}

      {hub.continueDiscussions.length > 0 ? (
        <View style={styles.section}>
          <AppText variant="cardTitle">{t("hub_continue")}</AppText>
          {hub.continueDiscussions.map((item) => (
            <FeedPostCard
              key={item.id}
              post={feedItemToPostModel(item)}
              excerptLines={3}
              onOpenThread={onOpenThread}
              onOpenMember={onOpenMember}
              onOpenZone={onOpenZone}
              onSelectTag={onOpenFeedWithTag}
            />
          ))}
        </View>
      ) : null}

      {hub.recommendedZones.length > 0 ? (
        <PanelCard style={styles.section}>
          <AppText variant="cardTitle">{t("hub_rooms")}</AppText>
          {hub.recommendedZones.map((zone) => (
            <View key={zone.id} style={[styles.zoneRow, { borderColor: palette.playLine, borderRadius: radii.inner }]}>
              <Pressable accessibilityRole="button" onPress={() => onOpenZone(zone.slug)} style={styles.zoneInfo}>
                <AppText style={styles.zoneTitle} numberOfLines={1}>
                  {zone.title}
                </AppText>
                <AppText variant="caption" tone="secondary" numberOfLines={1}>
                  {t("members_count", { count: zone.memberCount })}
                </AppText>
              </Pressable>
              {zone.myStatus !== "ACTIVE" ? (
                <Button
                  label={t("join_zone_cta")}
                  loading={joiningZoneId === zone.id}
                  onPress={() => void handleQuickJoin(zone.id)}
                  variant="secondary"
                />
              ) : null}
            </View>
          ))}
        </PanelCard>
      ) : null}

      {hub.supporters.length > 0 ? (
        <PanelCard style={styles.section}>
          <AppText variant="cardTitle">{t("hub_supporters")}</AppText>
          <View style={styles.chipsWrap}>
            {hub.supporters.map((person) => (
              <Pressable
                key={person.id}
                accessibilityRole="button"
                onPress={() => onOpenMember(person.username)}
                style={[
                  styles.supporterPill,
                  { backgroundColor: palette.surfaceAlt, borderColor: palette.border, borderRadius: radii.pill },
                ]}
              >
                <CommunityAvatar name={person.displayName} avatarUrl={person.avatarUrl} size={26} />
                <AppText variant="caption" style={{ fontWeight: "700" }} numberOfLines={1}>
                  {person.displayName}
                </AppText>
              </Pressable>
            ))}
          </View>
        </PanelCard>
      ) : null}

      {hub.trendingTags.length > 0 ? (
        <PanelCard style={styles.section}>
          <AppText variant="cardTitle">{t("hub_tags")}</AppText>
          <View style={styles.chipsWrap}>
            {hub.trendingTags.map((tag) => (
              <Chip
                key={tag.id}
                label={`#${tag.name} · ${tag.threadCount}`}
                onPress={() => onOpenFeedWithTag(tag.slug)}
              />
            ))}
          </View>
        </PanelCard>
      ) : null}

      <Button label={t("hub_open_feed")} onPress={onOpenFeed} variant="secondary" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 16 },
  section: { gap: 10 },
  disabledCard: { alignItems: "center", gap: 10, paddingVertical: 28 },
  disabledMascot: { width: 88, height: 88 },
  centeredText: { textAlign: "center" },
  heroCard: { gap: 12 },
  heroTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  mascot: { width: 58, height: 58 },
  bubble: { flex: 1, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10 },
  heroActions: { flexDirection: "row", alignItems: "center", gap: 10 },
  heroActionsStacked: { flexDirection: "column", alignItems: "stretch" },
  primaryWrap: { flex: 1 },
  ledgeText: { fontSize: 15, fontWeight: "800" },
  focusStrip: {
    minHeight: 44,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  zoneRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 10,
  },
  zoneInfo: { flex: 1, minHeight: 40, justifyContent: "center" },
  zoneTitle: { fontSize: 15, fontWeight: "700" },
  chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  supporterPill: {
    minHeight: 40,
    borderWidth: 1,
    paddingLeft: 6,
    paddingRight: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
});
