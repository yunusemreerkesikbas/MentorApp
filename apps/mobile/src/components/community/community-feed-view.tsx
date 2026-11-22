import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { ApiClientError } from "@mentor/api-client";
import type { ForumFeedScope, ForumFeedSort } from "@mentor/types";
import { useInfiniteQuery } from "@tanstack/react-query";
import { feedItemToPostModel, type CommunityPostModel } from "../../lib/community-view.js";
import { getForumFeed, isForumDisabled } from "../../lib/forum-api.js";
import { useAppAvailability } from "../../providers/availability-provider.js";
import { useTranslations } from "../../providers/i18n-provider.js";
import { LedgeButton } from "../panel/primitives.js";
import { AppText, Button, Chip, ScreenLoadingSkeleton, SlidingTabs, StateView } from "../ui/index.js";
import type { ComposerMode } from "./community-composer-sheet.js";
import { FeedPostCard } from "./feed-post-card.js";

type FeedSortTab = "featured" | "recent" | "following";
type ContentFilter = "all" | "posts" | "questions" | "waiting";

export function CommunityFeedView({
  selectedTag,
  onClearTag,
  onSelectTag,
  onCompose,
  onOpenZone,
  onOpenThread,
  onOpenMember,
}: {
  selectedTag: string | null;
  onClearTag: () => void;
  onSelectTag: (slug: string) => void;
  onCompose: (mode: ComposerMode) => void;
  onOpenZone: (slug: string) => void;
  onOpenThread: (post: CommunityPostModel) => void;
  onOpenMember: (username: string) => void;
}) {
  const { availability } = useAppAvailability();
  const t = useTranslations("community");
  const [sortTab, setSortTab] = useState<FeedSortTab>("featured");
  const [contentFilter, setContentFilter] = useState<ContentFilter>("all");

  const queryParams = useMemo(() => {
    const scope: ForumFeedScope = sortTab === "following" ? "following" : "relevant";
    const sort: ForumFeedSort = sortTab === "featured" ? "trending" : "recent";
    const contentType: "posts" | "questions" | undefined =
      contentFilter === "posts"
        ? "posts"
        : contentFilter === "questions" || contentFilter === "waiting"
          ? "questions"
          : undefined;
    const unanswered = contentFilter === "waiting" ? true : undefined;
    return {
      scope,
      sort,
      ...(selectedTag ? { tag: selectedTag } : {}),
      ...(contentType ? { contentType } : {}),
      ...(unanswered ? { unanswered: true } : {}),
    };
  }, [contentFilter, selectedTag, sortTab]);

  const feedQuery = useInfiniteQuery({
    queryKey: ["forum", "feed", queryParams],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => getForumFeed({ ...queryParams, cursor: pageParam }),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: availability.forum,
  });

  const items = useMemo(
    () => (feedQuery.data?.pages.flatMap((page) => page.items) ?? []).map(feedItemToPostModel),
    [feedQuery.data],
  );

  const hasFilters = contentFilter !== "all" || Boolean(selectedTag);

  if (!availability.forum || isForumDisabled(feedQuery.error)) {
    return <StateView title={t("soon_title")} body={t("soon_desc")} />;
  }

  return (
    <View style={styles.root}>
      <View style={styles.composeRow}>
        <View style={styles.composeMain}>
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

      <SlidingTabs
        variant="pill"
        compact
        accessibilityLabel={t("tab_feed")}
        value={sortTab}
        onChange={setSortTab}
        items={[
          { id: "featured", label: t("feed_sort_trending") },
          { id: "recent", label: t("feed_sort_recent") },
          { id: "following", label: t("feed_scope_following") },
        ]}
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsScroll}
      >
        {(["all", "posts", "questions", "waiting"] as const).map((key) => {
          const labelKey =
            key === "all"
              ? "feed_content_all"
              : key === "posts"
                ? "feed_content_posts"
                : key === "questions"
                  ? "feed_content_questions"
                  : "feed_content_waiting";
          return (
            <Chip
              key={key}
              label={t(labelKey)}
              selected={contentFilter === key}
              onPress={() => setContentFilter(key)}
            />
          );
        })}
        {selectedTag ? (
          <Chip label={`#${selectedTag} ×`} selected onPress={onClearTag} />
        ) : null}
      </ScrollView>

      {feedQuery.isLoading ? (
        <ScreenLoadingSkeleton />
      ) : feedQuery.isError ? (
        <StateView
          tone="error"
          title={t("error_title")}
          body={feedQuery.error instanceof ApiClientError ? feedQuery.error.message : t("soon_desc")}
          actionLabel={t("retry")}
          onAction={() => void feedQuery.refetch()}
        />
      ) : items.length === 0 ? (
        <StateView
          title={t("feed_empty_title")}
          body={
            sortTab === "following"
              ? t("following_feed_empty")
              : hasFilters
                ? t("feed_empty_filtered")
                : t("feed_empty_filtered")
          }
          actionLabel={hasFilters ? t("feed_clear_filters") : t("hub_share")}
          onAction={
            hasFilters
              ? () => {
                  setContentFilter("all");
                  onClearTag();
                }
              : () => onCompose("CHAT")
          }
        />
      ) : (
        <View style={styles.list}>
          {items.map((post) => (
            <FeedPostCard
              key={post.id}
              post={post}
              onOpenThread={onOpenThread}
              onOpenMember={onOpenMember}
              onOpenZone={onOpenZone}
              onSelectTag={onSelectTag}
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 12 },
  composeRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  composeMain: { flex: 1 },
  ledgeText: { fontSize: 15, fontWeight: "800" },
  chipsScroll: { gap: 8, paddingVertical: 2 },
  list: { gap: 12 },
});
