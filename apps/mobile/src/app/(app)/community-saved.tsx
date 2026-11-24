import { useMemo } from "react";
import { Image, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ApiClientError } from "@mentor/api-client";
import { BookmarkIcon as BookmarkSolidIcon } from "@solar-icons/react-native/bold/bookmark";
import { AltArrowLeftIcon } from "@solar-icons/react-native/linear/alt-arrow-left";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { PanelCard } from "../../components/panel/primitives.js";
import {
  AppText,
  Button,
  Chip,
  ScreenLoadingSkeleton,
  StateView,
} from "../../components/ui/index.js";
import { art } from "../../lib/art.js";
import { bookmarkPost, bookmarkThread, getBookmarks } from "../../lib/forum-api.js";
import { haptics } from "../../lib/haptics.js";
import { useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { useToast } from "../../providers/toast-provider.js";

export default function CommunitySavedScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { palette, space } = useThemeTokens();
  const t = useTranslations("community");
  const toast = useToast();

  const savedQuery = useInfiniteQuery({
    queryKey: ["forum", "bookmarks"],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => getBookmarks(pageParam),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const items = useMemo(
    () => savedQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [savedQuery.data],
  );

  async function handleRemove(type: "thread" | "comment", id: string) {
    haptics.selection();
    try {
      if (type === "thread") await bookmarkThread(id, false);
      else await bookmarkPost(id, false);
      await queryClient.invalidateQueries({ queryKey: ["forum"] });
    } catch (err) {
      toast.show(err instanceof ApiClientError ? err.message : t("error_title"));
    }
  }

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
            {t("saved_title")}
          </AppText>
          <View style={styles.spacer} />
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{
          padding: space.md,
          paddingBottom: insets.bottom + 24,
          gap: 12,
        }}
      >
        <AppText variant="caption" tone="secondary">
          {t("saved_subtitle")}
        </AppText>

        {savedQuery.isLoading ? (
          <ScreenLoadingSkeleton />
        ) : savedQuery.isError ? (
          <StateView
            tone="error"
            title={t("error_title")}
            body={savedQuery.error instanceof ApiClientError ? savedQuery.error.message : t("saved_subtitle")}
            actionLabel={t("retry")}
            onAction={() => void savedQuery.refetch()}
          />
        ) : items.length === 0 ? (
          <PanelCard style={styles.emptyCard}>
            <Image source={art.puhuDefault} style={styles.emptyMascot} resizeMode="contain" />
            <AppText variant="body" tone="secondary" style={styles.emptyText}>
              {t("saved_empty")}
            </AppText>
            <Button label={t("saved_go_feed")} onPress={() => router.back()} variant="secondary" />
          </PanelCard>
        ) : (
          <>
            {items.map((entry) => {
              const isThread = entry.type === "thread";
              const targetId = isThread ? entry.thread.id : entry.comment.threadId;
              const isQuestion = isThread && Boolean(entry.thread.title);
              return (
                <PanelCard key={isThread ? entry.thread.id : entry.comment.id} style={styles.card}>
                  <View style={styles.cardTop}>
                    <Chip label={isThread ? t("saved_thread_label") : t("saved_comment_label")} />
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t("bookmark_remove")}
                      onPress={() =>
                        void handleRemove(entry.type, isThread ? entry.thread.id : entry.comment.id)
                      }
                      style={styles.iconBtn}
                    >
                      <BookmarkSolidIcon size={20} color={palette.playSelectedInk} />
                    </Pressable>
                  </View>

                  <Pressable
                    accessibilityRole="button"
                    onPress={() =>
                      router.push({
                        pathname: "/(app)/community-thread",
                        params: {
                          id: targetId,
                          kind: isQuestion ? "question" : "thread",
                        },
                      })
                    }
                    style={styles.cardBody}
                  >
                    <AppText variant="caption" tone="muted">
                      {isThread ? entry.thread.authorName : entry.comment.authorName}
                    </AppText>
                    {isThread && entry.thread.title ? (
                      <AppText variant="cardTitle">{entry.thread.title}</AppText>
                    ) : null}
                    <AppText numberOfLines={4} variant="body" tone="secondary">
                      {isThread ? entry.thread.body : entry.comment.body}
                    </AppText>
                  </Pressable>
                </PanelCard>
              );
            })}
            {savedQuery.hasNextPage ? (
              <Button
                label={t("load_more")}
                loading={savedQuery.isFetchingNextPage}
                onPress={() => void savedQuery.fetchNextPage()}
                variant="secondary"
              />
            ) : null}
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
  emptyCard: { alignItems: "center", gap: 12, paddingVertical: 28 },
  emptyMascot: { width: 84, height: 84 },
  emptyText: { textAlign: "center" },
  card: { gap: 8 },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardBody: { gap: 4 },
});
