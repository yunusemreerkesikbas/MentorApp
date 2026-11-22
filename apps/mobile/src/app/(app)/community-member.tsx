import { useMemo, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ApiClientError } from "@mentor/api-client";
import type { CommunityBadgeId } from "@mentor/types";
import { AltArrowLeftIcon } from "@solar-icons/react-native/linear/alt-arrow-left";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { CommunityAvatar } from "../../components/community/community-avatar.js";
import { FeedPostCard } from "../../components/community/feed-post-card.js";
import { PanelCard } from "../../components/panel/primitives.js";
import {
  AppText,
  Button,
  Chip,
  ScreenLoadingSkeleton,
  SlidingTabs,
  StateView,
} from "../../components/ui/index.js";
import { achievementArt, levelArt } from "../../lib/art.js";
import {
  fetchProfileAchievements,
  fetchPublicProfile,
  followUser,
  unfollowUser,
} from "../../lib/community-api.js";
import { threadViewToPostModel } from "../../lib/community-view.js";
import { getUserForumActivity } from "../../lib/forum-api.js";
import { haptics } from "../../lib/haptics.js";
import { useAuth } from "../../providers/auth-provider.js";
import { useLocale, useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { useToast } from "../../providers/toast-provider.js";

function badgeLabelKey(id: CommunityBadgeId) {
  if (id === "marathon") return "badge_marathon" as const;
  if (id === "night_owl") return "badge_night_owl" as const;
  if (id === "motivator") return "badge_motivator" as const;
  return "badge_newcomer" as const;
}

function formatMemberSince(iso: string, locale: "tr" | "en"): string {
  try {
    return new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-US", {
      timeZone: "Europe/Istanbul",
      month: "long",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

export default function CommunityMemberScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { username } = useLocalSearchParams<{ username?: string }>();
  const { user } = useAuth();
  const { locale } = useLocale();
  const { palette, radii, space } = useThemeTokens();
  const t = useTranslations("community");
  const toast = useToast();

  const [tab, setTab] = useState<"posts" | "achievements">("posts");
  const [followBusy, setFollowBusy] = useState(false);

  const cleanUsername = typeof username === "string" ? username.trim() : "";

  const profileQuery = useQuery({
    queryKey: ["community", "profile", cleanUsername],
    queryFn: () => fetchPublicProfile(cleanUsername),
    enabled: Boolean(cleanUsername),
  });

  const achievementsQuery = useQuery({
    queryKey: ["community", "profile-achievements", cleanUsername],
    queryFn: () => fetchProfileAchievements(cleanUsername),
    enabled: Boolean(cleanUsername) && Boolean(profileQuery.data?.achievementsEnabled),
  });

  const activityQuery = useInfiniteQuery({
    queryKey: ["forum", "member-activity", cleanUsername],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => getUserForumActivity(cleanUsername, pageParam),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: Boolean(cleanUsername),
  });

  const activityItems = useMemo(
    () => activityQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [activityQuery.data],
  );

  async function handleFollowToggle() {
    const profile = profileQuery.data;
    if (!profile || followBusy) return;
    setFollowBusy(true);
    haptics.selection();
    try {
      if (profile.isFollowing) await unfollowUser(profile.username);
      else await followUser(profile.username);
      await queryClient.invalidateQueries({ queryKey: ["community", "profile", cleanUsername] });
      await queryClient.invalidateQueries({ queryKey: ["forum", "feed"] });
    } catch (err) {
      toast.show(err instanceof ApiClientError ? err.message : t("error_title"));
    } finally {
      setFollowBusy(false);
    }
  }

  const profile = profileQuery.data;
  const isSelf = Boolean(profile && user && profile.userId === user.id);

  return (
    <View style={[styles.screen, { backgroundColor: palette.bg }]}>
      <View
        style={[
          styles.topChrome,
          {
            paddingTop: insets.top,
            backgroundColor: palette.surface,
            borderBottomColor: palette.playLine,
          },
        ]}
      >
        <View style={styles.navBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("back_cta")}
            onPress={() => router.back()}
            style={styles.iconBtn}
          >
            <AltArrowLeftIcon size={22} color={palette.main} strokeWidth={1.75} />
          </Pressable>
          <AppText accessibilityRole="header" style={styles.navTitle} numberOfLines={1}>
            {profile ? profile.displayName : t("profile_title")}
          </AppText>
          <View style={styles.spacer} />
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{
          padding: space.md,
          paddingBottom: insets.bottom + 24,
          gap: 14,
        }}
      >
        {!cleanUsername || profileQuery.isError ? (
          <StateView
            tone="error"
            title={t("profile_title")}
            body={t("profile_not_found")}
            actionLabel={t("back_cta")}
            onAction={() => router.back()}
          />
        ) : profileQuery.isLoading || !profile ? (
          <ScreenLoadingSkeleton />
        ) : (
          <>
            <PanelCard style={styles.cardGap}>
              <View style={styles.identityRow}>
                <CommunityAvatar name={profile.displayName} avatarUrl={profile.avatarUrl} size={60} />
                <View style={styles.identityMeta}>
                  <AppText variant="title">{profile.displayName}</AppText>
                  <AppText variant="caption" tone="muted">{`@${profile.username}`}</AppText>
                  <AppText variant="caption" tone="muted">
                    {t("profile_member_since", {
                      date: formatMemberSince(profile.createdAt, locale),
                    })}
                  </AppText>
                </View>
              </View>

              {profile.bio ? (
                <AppText variant="body" tone="secondary">
                  {profile.bio}
                </AppText>
              ) : null}

              {!isSelf ? (
                <Button
                  label={profile.isFollowing ? t("following_state") : t("follow")}
                  loading={followBusy}
                  onPress={() => void handleFollowToggle()}
                  variant={profile.isFollowing ? "secondary" : "primary"}
                />
              ) : null}

              <View style={[styles.statsRow, { borderTopColor: palette.playLine }]}>
                <View style={styles.statBox}>
                  <AppText variant="cardTitle" tabularNums>{profile.followerCount}</AppText>
                  <AppText variant="caption" tone="muted">{t("followers_label")}</AppText>
                </View>
                <View style={styles.statBox}>
                  <AppText variant="cardTitle" tabularNums>{profile.followingCount}</AppText>
                  <AppText variant="caption" tone="muted">{t("following_label")}</AppText>
                </View>
                <View style={styles.statBox}>
                  <AppText variant="cardTitle" tabularNums>{profile.activityCount}</AppText>
                  <AppText variant="caption" tone="muted">{t("activity_label")}</AppText>
                </View>
              </View>

              <View style={styles.chipsWrap}>
                {profile.streak > 0 ? (
                  <Chip label={t("profile_streak", { count: profile.streak })} tone="success" />
                ) : null}
                {profile.level ? (
                  <View
                    style={[
                      styles.levelPill,
                      {
                        backgroundColor: palette.playSelected,
                        borderColor: palette.ctaPlayEdge,
                        borderRadius: radii.pill,
                      },
                    ]}
                  >
                    <Image source={levelArt[profile.level.key]} style={styles.levelIcon} resizeMode="contain" />
                    <AppText variant="caption" style={{ color: palette.playSelectedInk, fontWeight: "800" }}>
                      {`${t("profile_level_label", { tier: profile.level.tier })}${profile.xp !== null ? ` · ${t("xp_label", { xp: profile.xp })}` : ""}`}
                    </AppText>
                  </View>
                ) : null}
                {profile.badges.map((badge) => (
                  <Chip key={badge} label={t(badgeLabelKey(badge))} tone="coach" />
                ))}
              </View>
            </PanelCard>

            {profile.achievementsEnabled ? (
              <SlidingTabs
                variant="pill"
                accessibilityLabel={t("profile_title")}
                value={tab}
                onChange={setTab}
                items={[
                  { id: "posts", label: t("profile_tab_posts") },
                  { id: "achievements", label: t("profile_tab_achievements") },
                ]}
              />
            ) : null}

            {tab === "achievements" && profile.achievementsEnabled ? (
              achievementsQuery.isLoading ? (
                <ScreenLoadingSkeleton />
              ) : !achievementsQuery.data || achievementsQuery.data.items.length === 0 ? (
                <StateView title={t("profile_tab_achievements")} body={t("profile_achievements_empty")} />
              ) : (
                <View style={styles.list}>
                  {achievementsQuery.data.items.map((item) => {
                    const earned = item.status === "EARNED";
                    return (
                      <PanelCard key={item.id} style={[styles.achRow, !earned && { opacity: 0.6 }]}>
                        <Image source={achievementArt[item.artKey]} style={styles.achArt} resizeMode="contain" />
                        <View style={{ flex: 1, gap: 2 }}>
                          <AppText variant="cardTitle">{item.title}</AppText>
                          <AppText variant="caption" tone="secondary">
                            {earned ? item.description : item.unlockHint}
                          </AppText>
                        </View>
                      </PanelCard>
                    );
                  })}
                </View>
              )
            ) : activityQuery.isLoading ? (
              <ScreenLoadingSkeleton />
            ) : activityItems.length === 0 ? (
              <StateView title={t("profile_tab_posts")} body={t("profile_activity_empty")} />
            ) : (
              <View style={styles.list}>
                {activityItems.map((entry) => {
                  if (entry.type === "thread") {
                    const zoneType = entry.thread.title ? "QA" : "CHAT";
                    const post = threadViewToPostModel(entry.thread, {
                      id: entry.thread.zoneId,
                      title: entry.zone.title,
                      slug: entry.zone.slug,
                      type: zoneType,
                    });
                    return (
                      <FeedPostCard
                        key={entry.thread.id}
                        post={post}
                        excerptLines={4}
                        onOpenThread={(p) =>
                          router.push({
                            pathname: "/(app)/community-thread",
                            params: { id: p.id, kind: zoneType === "QA" ? "question" : "thread" },
                          })
                        }
                        onOpenZone={(slug) =>
                          router.replace({
                            pathname: "/(app)/(tabs)/community",
                            params: { tab: "forum", zoneSlug: slug },
                          })
                        }
                      />
                    );
                  }
                  return (
                    <Pressable
                      key={entry.comment.id}
                      accessibilityRole="button"
                      onPress={() =>
                        router.push({
                          pathname: "/(app)/community-thread",
                          params: { id: entry.comment.threadId, kind: "thread" },
                        })
                      }
                    >
                      <PanelCard style={styles.commentCard}>
                        <AppText variant="caption" tone="muted">{entry.zone.title}</AppText>
                        <AppText numberOfLines={4} variant="body">{entry.comment.body}</AppText>
                      </PanelCard>
                    </Pressable>
                  );
                })}
                {activityQuery.hasNextPage ? (
                  <Button
                    label={t("load_more")}
                    loading={activityQuery.isFetchingNextPage}
                    onPress={() => void activityQuery.fetchNextPage()}
                    variant="secondary"
                  />
                ) : null}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topChrome: { borderBottomWidth: StyleSheet.hairlineWidth },
  navBar: { height: 56, flexDirection: "row", alignItems: "center", paddingHorizontal: 8 },
  iconBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  navTitle: { flex: 1, fontSize: 17, fontWeight: "800", textAlign: "center" },
  spacer: { width: 44 },
  scroll: { flex: 1 },
  cardGap: { gap: 12 },
  identityRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  identityMeta: { flex: 1, gap: 2 },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
  },
  statBox: { alignItems: "center", gap: 2 },
  chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" },
  levelPill: {
    minHeight: 34,
    borderWidth: 1,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  levelIcon: { width: 20, height: 20 },
  list: { gap: 12 },
  achRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  achArt: { width: 44, height: 44 },
  commentCard: { gap: 4 },
});
