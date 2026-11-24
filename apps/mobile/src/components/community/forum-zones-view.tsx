import { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { ApiClientError } from "@mentor/api-client";
import type { ZoneType, ZoneView } from "@mentor/types";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  groupZonesByMembership,
  threadViewToPostModel,
  type CommunityPostModel,
} from "../../lib/community-view.js";
import {
  getZoneFeed,
  isForumDisabled,
  joinZone,
  leaveZone,
  listForumZones,
  type ThreadSort,
} from "../../lib/forum-api.js";
import { haptics } from "../../lib/haptics.js";
import { useAppAvailability } from "../../providers/availability-provider.js";
import { useTranslations } from "../../providers/i18n-provider.js";
import { useToast } from "../../providers/toast-provider.js";
import { LedgeButton, PanelCard } from "../panel/primitives.js";
import {
  AppText,
  Button,
  Chip,
  ConfirmDialog,
  ScreenLoadingSkeleton,
  SlidingTabs,
  StateView,
} from "../ui/index.js";
import type { ComposerMode } from "./community-composer-sheet.js";
import { FeedPostCard } from "./feed-post-card.js";

function zoneTypeLabelKey(type: ZoneType): "type_announcement" | "type_qa" | "type_chat" {
  if (type === "ANNOUNCEMENT") return "type_announcement";
  if (type === "QA") return "type_qa";
  return "type_chat";
}

export function ForumZonesView({
  initialSlug,
  onClearInitialSlug,
  onCompose,
  onOpenThread,
  onOpenMember,
}: {
  initialSlug?: string | null;
  onClearInitialSlug?: () => void;
  onCompose: (mode: ComposerMode, zoneId: string) => void;
  onOpenThread: (post: CommunityPostModel) => void;
  onOpenMember: (username: string) => void;
}) {
  const queryClient = useQueryClient();
  const { availability } = useAppAvailability();
  const t = useTranslations("community");
  const tCommon = useTranslations("common");
  const toast = useToast();

  const [selectedSlug, setSelectedSlug] = useState<string | null>(initialSlug ?? null);
  const [sort, setSort] = useState<ThreadSort>("recent");
  const [membershipBusy, setMembershipBusy] = useState(false);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);

  useEffect(() => {
    if (initialSlug) {
      setSelectedSlug(initialSlug);
      onClearInitialSlug?.();
    }
  }, [initialSlug, onClearInitialSlug]);

  const zonesQuery = useQuery({
    queryKey: ["forum", "zones"],
    queryFn: listForumZones,
    enabled: availability.forum,
  });

  const grouped = useMemo(
    () => groupZonesByMembership(zonesQuery.data ?? []),
    [zonesQuery.data],
  );

  const orderedZones = useMemo(
    () => [...grouped.mine, ...grouped.others],
    [grouped.mine, grouped.others],
  );

  const activeZone: ZoneView | null = useMemo(() => {
    if (orderedZones.length === 0) return null;
    return orderedZones.find((z) => z.slug === selectedSlug) ?? orderedZones[0]!;
  }, [orderedZones, selectedSlug]);

  const feedQuery = useInfiniteQuery({
    queryKey: ["forum", "zone-feed", activeZone?.slug ?? "", sort],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => getZoneFeed(activeZone!.slug, sort, pageParam),
    getNextPageParam: (last) => last.feed.nextCursor ?? undefined,
    enabled: Boolean(activeZone) && availability.forum,
  });

  const posts = useMemo(() => {
    if (!activeZone || !feedQuery.data) return [];
    const zoneRef = {
      id: activeZone.id,
      title: activeZone.title,
      slug: activeZone.slug,
      type: activeZone.type,
    };
    return feedQuery.data.pages.flatMap((page) =>
      page.feed.items.map((thread) => threadViewToPostModel(thread, zoneRef)),
    );
  }, [activeZone, feedQuery.data]);

  async function handleJoin() {
    if (!activeZone || membershipBusy) return;
    setMembershipBusy(true);
    haptics.selection();
    try {
      await joinZone(activeZone.id);
      await queryClient.invalidateQueries({ queryKey: ["forum"] });
    } catch (err) {
      toast.show(err instanceof ApiClientError ? err.message : t("error_title"));
    } finally {
      setMembershipBusy(false);
    }
  }

  async function handleLeaveConfirm() {
    if (!activeZone || membershipBusy) return;
    setMembershipBusy(true);
    try {
      await leaveZone(activeZone.id);
      setLeaveConfirmOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["forum"] });
    } catch (err) {
      toast.show(err instanceof ApiClientError ? err.message : t("error_title"));
    } finally {
      setMembershipBusy(false);
    }
  }

  if (!availability.forum || isForumDisabled(zonesQuery.error)) {
    return <StateView title={t("soon_title")} body={t("soon_desc")} />;
  }

  if (zonesQuery.isLoading) {
    return <ScreenLoadingSkeleton />;
  }

  if (zonesQuery.isError) {
    return (
      <StateView
        tone="error"
        title={t("error_title")}
        body={zonesQuery.error instanceof ApiClientError ? zonesQuery.error.message : t("zones_empty")}
        actionLabel={t("retry")}
        onAction={() => void zonesQuery.refetch()}
      />
    );
  }

  if (orderedZones.length === 0 || !activeZone) {
    return <StateView title={t("zones_title")} body={t("zones_empty")} />;
  }

  const isMember = activeZone.myStatus === "ACTIVE";
  const canPost = isMember && activeZone.type !== "ANNOUNCEMENT";

  return (
    <View style={styles.root}>
      {grouped.mine.length > 0 ? (
        <View style={styles.groupWrap}>
          <AppText variant="micro" tone="muted">
            {t("group_mine")}
          </AppText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
            {grouped.mine.map((zone) => (
              <Chip
                key={zone.id}
                label={zone.title}
                selected={zone.id === activeZone.id}
                onPress={() => setSelectedSlug(zone.slug)}
              />
            ))}
          </ScrollView>
        </View>
      ) : null}

      {grouped.others.length > 0 ? (
        <View style={styles.groupWrap}>
          <AppText variant="micro" tone="muted">
            {t("group_others")}
          </AppText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
            {grouped.others.map((zone) => (
              <Chip
                key={zone.id}
                label={zone.title}
                selected={zone.id === activeZone.id}
                onPress={() => setSelectedSlug(zone.slug)}
              />
            ))}
          </ScrollView>
        </View>
      ) : null}

      <PanelCard style={styles.zoneCard}>
        <View style={styles.zoneTopRow}>
          <Chip label={t(zoneTypeLabelKey(activeZone.type))} />
          <AppText variant="caption" tone="muted" tabularNums>
            {`${t("members_count", { count: activeZone.memberCount })} · ${t("messages_count", { count: activeZone.threadCount })}`}
          </AppText>
        </View>

        <AppText variant="title">{activeZone.title}</AppText>
        {activeZone.description ? (
          <AppText variant="body" tone="secondary">
            {activeZone.description}
          </AppText>
        ) : null}

        {isMember ? (
          <View style={styles.memberActions}>
            {canPost ? (
              <View style={styles.composeFlex}>
                <LedgeButton
                  accessibilityLabel={activeZone.type === "QA" ? t("hub_ask") : t("hub_share")}
                  onPress={() => onCompose(activeZone.type === "QA" ? "QA" : "CHAT", activeZone.id)}
                >
                  {(ink) => (
                    <AppText style={[styles.ledgeText, { color: ink }]} numberOfLines={1}>
                      {activeZone.type === "QA" ? t("hub_ask") : t("hub_share")}
                    </AppText>
                  )}
                </LedgeButton>
              </View>
            ) : null}
            <Button
              label={t("leave_zone_cta")}
              onPress={() => setLeaveConfirmOpen(true)}
              loading={membershipBusy}
              variant="secondary"
            />
          </View>
        ) : (
          <View style={styles.joinBox}>
            <AppText variant="caption" tone="secondary">
              {t("zone_join_hint")}
            </AppText>
            <LedgeButton accessibilityLabel={t("join_zone_cta")} onPress={() => void handleJoin()}>
              {(ink) => (
                <AppText style={[styles.ledgeText, { color: ink }]} numberOfLines={1}>
                  {t("join_zone_cta")}
                </AppText>
              )}
            </LedgeButton>
          </View>
        )}
      </PanelCard>

      <SlidingTabs
        variant="pill"
        accessibilityLabel={t("zones_title")}
        value={sort}
        onChange={setSort}
        items={[
          { id: "recent", label: t("sort_recent") },
          { id: "popular", label: t("sort_popular") },
        ]}
      />

      {feedQuery.isLoading ? (
        <ScreenLoadingSkeleton />
      ) : feedQuery.isError ? (
        <StateView
          tone="error"
          title={t("error_title")}
          body={feedQuery.error instanceof ApiClientError ? feedQuery.error.message : t("threads_empty")}
          actionLabel={t("retry")}
          onAction={() => void feedQuery.refetch()}
        />
      ) : posts.length === 0 ? (
        <StateView
          title={activeZone.title}
          body={t("threads_empty")}
          actionLabel={canPost ? t("post_thread_cta") : undefined}
          onAction={
            canPost
              ? () => onCompose(activeZone.type === "QA" ? "QA" : "CHAT", activeZone.id)
              : undefined
          }
        />
      ) : (
        <View style={styles.feedList}>
          {posts.map((post) => (
            <FeedPostCard
              key={post.id}
              post={post}
              showZone={false}
              onOpenThread={onOpenThread}
              onOpenMember={onOpenMember}
            />
          ))}
          {feedQuery.hasNextPage ? (
            <Button
              label={t("load_more")}
              loading={feedQuery.isFetchingNextPage}
              onPress={() => void feedQuery.fetchNextPage()}
              variant="secondary"
            />
          ) : null}
        </View>
      )}

      <ConfirmDialog
        visible={leaveConfirmOpen}
        title={t("leave_zone_confirm_title")}
        message={t("leave_zone_confirm_body")}
        confirmLabel={t("leave_zone_cta")}
        cancelLabel={tCommon("cancel")}
        destructive
        onCancel={() => setLeaveConfirmOpen(false)}
        onConfirm={() => void handleLeaveConfirm()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 12 },
  groupWrap: { gap: 6 },
  chipsRow: { gap: 8, paddingVertical: 2 },
  zoneCard: { gap: 10 },
  zoneTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  memberActions: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 2 },
  composeFlex: { flex: 1 },
  joinBox: { gap: 8, marginTop: 2 },
  ledgeText: { fontSize: 15, fontWeight: "800" },
  feedList: { gap: 12 },
});
