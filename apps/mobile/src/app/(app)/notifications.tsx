import { useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { resolveNotificationMobileRoute } from "@mentor/core";
import type { NotificationCategory, UserNotificationDto } from "@mentor/types";
import {
  AppText,
  Button,
  Card,
  Chip,
  ScreenLoadingSkeleton,
  StateView,
} from "../../components/ui/index.js";
import { haptics } from "../../lib/haptics.js";
import {
  deleteNotification,
  fetchNotificationPreferences,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  updateNotificationPreferences,
} from "../../lib/notifications-api.js";
import { useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";

const CATEGORIES: ("ALL" | NotificationCategory)[] = [
  "ALL",
  "COACH",
  "PLAN",
  "FORUM",
  "ACHIEVEMENT",
  "MENTORSHIP",
  "SYSTEM",
];

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { palette, radii, space } = useThemeTokens();
  const t = useTranslations("notifications");
  const tCommon = useTranslations("common");

  const [selectedCategory, setSelectedCategory] = useState<
    "ALL" | NotificationCategory
  >("ALL");

  const categoryFilter =
    selectedCategory === "ALL" ? undefined : selectedCategory;

  const listQuery = useQuery({
    queryKey: ["notifications", "list", selectedCategory],
    queryFn: () => listNotifications(categoryFilter, 1),
  });

  const prefsQuery = useQuery({
    queryKey: ["notifications", "preferences"],
    queryFn: fetchNotificationPreferences,
  });

  const invalidateList = async () => {
    await queryClient.invalidateQueries({ queryKey: ["notifications"] });
  };

  const markAllMutation = useMutation({
    mutationFn: () => markAllNotificationsRead(),
    onSuccess: async () => {
      haptics.success();
      await invalidateList();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteNotification(id),
    onSuccess: async () => {
      haptics.lightImpact();
      await invalidateList();
    },
  });

  const prefMutation = useMutation({
    mutationFn: updateNotificationPreferences,
    onSuccess: async () => {
      haptics.selection();
      await queryClient.invalidateQueries({
        queryKey: ["notifications", "preferences"],
      });
    },
  });

  const handleOpenNotification = async (item: UserNotificationDto) => {
    haptics.selection();
    if (!item.readAt) {
      try {
        await markNotificationRead(item.id);
        await invalidateList();
      } catch {
        // Non-blocking if already marked read
      }
    }
    const targetRoute = resolveNotificationMobileRoute(item.linkUrl);
    if (targetRoute) {
      router.push(targetRoute as never);
    }
  };

  const items = listQuery.data?.items ?? [];
  const unreadCount = listQuery.data?.unreadCount ?? 0;
  const prefs = prefsQuery.data;

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.id}
      style={{ flex: 1, backgroundColor: palette.bg }}
      contentInsetAdjustmentBehavior="automatic"
      refreshControl={
        <RefreshControl
          refreshing={listQuery.isRefetching}
          onRefresh={() => void invalidateList()}
          tintColor={palette.accent}
        />
      }
      contentContainerStyle={{
        paddingTop: insets.top + space.lg,
        paddingBottom: space.xl,
        paddingHorizontal: space.lg,
        gap: space.sm,
      }}
      ListHeaderComponent={
        <View style={{ gap: space.lg, marginBottom: space.sm }}>
          <View style={styles.headerRow}>
            <View style={{ flex: 1, gap: 4 }}>
              <AppText variant="title">{t("title")}</AppText>
              <AppText variant="caption" tone="secondary">
                {t("subtitle")}
              </AppText>
            </View>
            <Chip label={t("back_cta")} onPress={() => router.back()} />
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8 }}
          >
            {CATEGORIES.map((cat) => (
              <Chip
                key={cat}
                label={t(`cat_${cat}` as never)}
                selected={selectedCategory === cat}
                onPress={() => {
                  haptics.selection();
                  setSelectedCategory(cat);
                }}
              />
            ))}
          </ScrollView>

          {unreadCount > 0 ? (
            <Button
              label={t("mark_all_read_cta")}
              variant="secondary"
              loading={markAllMutation.isPending}
              onPress={() => markAllMutation.mutate()}
            />
          ) : null}
        </View>
      }
      ListEmptyComponent={
        listQuery.isLoading ? (
          <ScreenLoadingSkeleton />
        ) : listQuery.isError ? (
          <StateView
            title={tCommon("error_title")}
            body={tCommon("error_body")}
            actionLabel={tCommon("retry")}
            onAction={() => void listQuery.refetch()}
            tone="error"
          />
        ) : (
          <Card style={{ gap: 6 }}>
            <AppText variant="cardTitle">{t("empty_title")}</AppText>
            <AppText variant="body" tone="secondary">
              {t("empty_body")}
            </AppText>
          </Card>
        )
      }
      renderItem={({ item }) => {
        const isUnread = !item.readAt;
        const targetRoute = resolveNotificationMobileRoute(item.linkUrl);
        return (
          <Pressable
            onPress={() => void handleOpenNotification(item)}
            style={{
              padding: space.md,
              borderRadius: radii.inner,
              borderWidth: 1,
              borderColor: isUnread ? palette.accent : palette.border,
              backgroundColor: isUnread
                ? palette.surfaceHover
                : palette.surface,
              gap: 8,
            }}
          >
            <View style={styles.rowBetween}>
              <Chip label={t(`cat_${item.category}` as never)} />
              <AppText variant="micro" tone="muted">
                {item.createdAt.slice(0, 10)}
              </AppText>
            </View>

            <AppText variant="cardTitle">{item.title}</AppText>
            <AppText variant="body" tone="secondary">
              {item.body}
            </AppText>

            <View style={styles.rowBetween}>
              {targetRoute ? (
                <AppText variant="caption" tone="accent">
                  {t("open_link_cta")} →
                </AppText>
              ) : (
                <View />
              )}
              <Chip
                label={t("delete_cta")}
                onPress={() => deleteMutation.mutate(item.id)}
              />
            </View>
          </Pressable>
        );
      }}
      ListFooterComponent={
        prefs ? (
          <Card style={{ gap: space.sm, marginTop: space.md }}>
            <AppText variant="sectionHeading">{t("prefs_title")}</AppText>

            <View style={styles.rowBetween}>
              <AppText variant="body">{t("pref_push")}</AppText>
              <Chip
                label={prefs.pushEnabled ? t("pref_on") : t("pref_off")}
                selected={prefs.pushEnabled}
                onPress={() =>
                  prefMutation.mutate({ pushEnabled: !prefs.pushEnabled })
                }
              />
            </View>

            <View style={styles.rowBetween}>
              <AppText variant="body">{t("pref_email")}</AppText>
              <Chip
                label={prefs.emailEnabled ? t("pref_on") : t("pref_off")}
                selected={prefs.emailEnabled}
                onPress={() =>
                  prefMutation.mutate({ emailEnabled: !prefs.emailEnabled })
                }
              />
            </View>

            <View style={styles.rowBetween}>
              <AppText variant="body">{t("pref_campaigns")}</AppText>
              <Chip
                label={prefs.campaignsEnabled ? t("pref_on") : t("pref_off")}
                selected={prefs.campaignsEnabled}
                onPress={() =>
                  prefMutation.mutate({
                    campaignsEnabled: !prefs.campaignsEnabled,
                  })
                }
              />
            </View>
          </Card>
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
});
