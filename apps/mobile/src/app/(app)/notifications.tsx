import { useState } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ApiClientError } from "@mentor/api-client";
import type { UserNotificationDto } from "@mentor/types";
import { NotificationChannelsCard } from "../../components/notifications/notification-channels-card.js";
import { NotificationRow } from "../../components/notifications/notification-row.js";
import {
  NotificationsEmpty,
  NotificationsHeader,
  type NotificationInboxTab,
} from "../../components/notifications/notifications-chrome.js";
import { NotificationsSkeleton } from "../../components/notifications/notifications-skeleton.js";
import { ActionSheet, type SheetAction } from "../../components/panel/primitives.js";
import { AppText, Button, StateView } from "../../components/ui/index.js";
import { haptics } from "../../lib/haptics.js";
import {
  deleteNotification,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  markNotificationUnread,
} from "../../lib/notifications-api.js";
import {
  flattenNotificationGroups,
  resolveMobileNotificationDestination,
  type NotificationListRow,
  type NotificationRecencyGroup,
} from "../../lib/notifications-view.js";
import { STUDENT_CORE_ONLY } from "../../lib/release-scope.js";
import { useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { useToast } from "../../providers/toast-provider.js";

const GROUP_LABEL_KEY: Record<
  NotificationRecencyGroup,
  "group_today" | "group_week" | "group_earlier"
> = {
  today: "group_today",
  week: "group_week",
  earlier: "group_earlier",
};

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { palette, space } = useThemeTokens();
  const t = useTranslations("notifications");
  const tCommon = useTranslations("common");

  const [activeTab, setActiveTab] = useState<NotificationInboxTab>("ALL");
  const [actionItem, setActionItem] = useState<UserNotificationDto | null>(null);

  const listQuery = useInfiniteQuery({
    queryKey: ["notifications", "inbox"],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => listNotifications(undefined, pageParam),
    getNextPageParam: (lastPage, allPages) =>
      lastPage.hasMore ? allPages.length + 1 : undefined,
  });

  const invalidateInbox = async () => {
    await queryClient.invalidateQueries({ queryKey: ["notifications"] });
  };

  const showErrorToast = (err: unknown) => {
    haptics.error();
    toast.show(err instanceof ApiClientError ? err.message : tCommon("error_body"));
  };

  const markAllMutation = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: async () => {
      haptics.success();
      await invalidateInbox();
    },
    onError: showErrorToast,
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: async () => {
      haptics.selection();
      await invalidateInbox();
    },
    onError: showErrorToast,
  });

  const markUnreadMutation = useMutation({
    mutationFn: (id: string) => markNotificationUnread(id),
    onSuccess: async () => {
      haptics.selection();
      await invalidateInbox();
    },
    onError: showErrorToast,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteNotification(id),
    onSuccess: async () => {
      haptics.lightImpact();
      await invalidateInbox();
    },
    onError: showErrorToast,
  });

  const pages = listQuery.data?.pages ?? [];
  const allItems = pages.flatMap((page) => page.items);
  const unreadCount = pages[0]?.unreadCount ?? 0;
  const visibleItems =
    activeTab === "ALL"
      ? allItems
      : allItems.filter((item) => item.readAt === null);

  const rows: NotificationListRow[] =
    listQuery.isLoading || listQuery.isError
      ? []
      : flattenNotificationGroups(visibleItems);

  const handleOpenNotification = async (item: UserNotificationDto) => {
    haptics.selection();
    if (!item.readAt) {
      try {
        await markNotificationRead(item.id);
        await invalidateInbox();
      } catch {
        // Non-blocking if already marked read or temporarily offline.
      }
    }
    const dest = resolveMobileNotificationDestination(
      item.linkUrl,
      STUDENT_CORE_ONLY,
    );
    if (!dest) return;
    if (dest.pathname.startsWith("/(app)/(tabs)/")) {
      router.navigate(dest as never);
    } else {
      router.push(dest as never);
    }
  };

  const sheetActions: SheetAction[] = actionItem
    ? [
        {
          label: actionItem.readAt ? t("mark_unread_cta") : t("mark_read_cta"),
          onPress: () => {
            if (actionItem.readAt) {
              markUnreadMutation.mutate(actionItem.id);
            } else {
              markReadMutation.mutate(actionItem.id);
            }
          },
        },
        {
          label: t("delete_cta"),
          tone: "danger",
          onPress: () => deleteMutation.mutate(actionItem.id),
        },
      ]
    : [];

  return (
    <View style={[styles.screen, { backgroundColor: palette.bg }]}>
      <NotificationsHeader
        unreadCount={unreadCount}
        activeTab={activeTab}
        markingAll={markAllMutation.isPending}
        onBack={() => router.back()}
        onMarkAllRead={() => markAllMutation.mutate()}
        onTabChange={setActiveTab}
      />

      <FlatList
        data={rows}
        keyExtractor={(row) => row.key}
        style={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={listQuery.isRefetching && !listQuery.isFetchingNextPage}
            onRefresh={() => void invalidateInbox()}
            tintColor={palette.accent}
          />
        }
        contentContainerStyle={{
          paddingBottom: insets.bottom + space["2xl"],
        }}
        renderItem={({ item: row }) => {
          if (row.kind === "header") {
            return (
              <View
                style={[
                  styles.sectionHeader,
                  { backgroundColor: palette.surface },
                ]}
              >
                <AppText style={[styles.sectionTitle, { color: palette.secondary }]}>
                  {t(GROUP_LABEL_KEY[row.group])}
                </AppText>
              </View>
            );
          }

          return (
            <NotificationRow
              item={row.item}
              onPress={() => void handleOpenNotification(row.item)}
              onOpenActions={() => {
                haptics.selection();
                setActionItem(row.item);
              }}
            />
          );
        }}
        ListEmptyComponent={
          listQuery.isLoading ? (
            <View style={{ backgroundColor: palette.surface }}>
              <NotificationsSkeleton />
            </View>
          ) : listQuery.isError ? (
            <View style={{ padding: space.xl }}>
              <StateView
                title={tCommon("error_title")}
                body={tCommon("error_body")}
                actionLabel={tCommon("retry")}
                onAction={() => void listQuery.refetch()}
                tone="error"
              />
            </View>
          ) : (
            <NotificationsEmpty unreadTab={activeTab === "UNREAD"} />
          )
        }
        ListFooterComponent={
          <View style={{ paddingHorizontal: space.xl, paddingTop: space.xl, gap: space.lg }}>
            {listQuery.hasNextPage ? (
              <Button
                label={t("load_more")}
                variant="secondary"
                loading={listQuery.isFetchingNextPage}
                onPress={() => void listQuery.fetchNextPage()}
              />
            ) : null}
            <NotificationChannelsCard />
          </View>
        }
      />

      <ActionSheet
        title={actionItem?.title ?? null}
        actions={sheetActions}
        onClose={() => setActionItem(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  list: {
    flex: 1,
  },
  sectionHeader: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 6,
  },
  sectionTitle: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
  },
});
