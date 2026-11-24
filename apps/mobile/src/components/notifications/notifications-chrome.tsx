import { ActivityIndicator, Image, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AltArrowLeftIcon } from "@solar-icons/react-native/linear/alt-arrow-left";
import { CheckReadIcon } from "@solar-icons/react-native/linear/check-read";
import { art } from "../../lib/art.js";
import { useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { AppText, SlidingTabs } from "../ui/index.js";

export type NotificationInboxTab = "ALL" | "UNREAD";

export function NotificationsHeader({
  unreadCount,
  activeTab,
  markingAll,
  onBack,
  onMarkAllRead,
  onTabChange,
}: {
  unreadCount: number;
  activeTab: NotificationInboxTab;
  markingAll: boolean;
  onBack: () => void;
  onMarkAllRead: () => void;
  onTabChange: (tab: NotificationInboxTab) => void;
}) {
  const insets = useSafeAreaInsets();
  const { palette, radii } = useThemeTokens();
  const t = useTranslations("notifications");

  return (
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
      <View style={styles.headerBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("back_cta")}
          onPress={onBack}
          style={styles.iconBtn}
        >
          <AltArrowLeftIcon size={22} color={palette.main} strokeWidth={1.75} />
        </Pressable>

        <View style={styles.titleRow}>
          <AppText accessibilityRole="header" style={styles.headerTitle}>
            {t("title")}
          </AppText>
          {unreadCount > 0 ? (
            <View
              style={[
                styles.unreadBadge,
                { backgroundColor: palette.playSelected, borderRadius: radii.pill },
              ]}
            >
              <AppText
                variant="caption"
                tabularNums
                style={{ color: palette.playSelectedInk, fontWeight: "800" }}
              >
                {unreadCount > 99 ? "99+" : String(unreadCount)}
              </AppText>
            </View>
          ) : null}
        </View>

        {unreadCount > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("mark_all_read_cta")}
            disabled={markingAll}
            onPress={onMarkAllRead}
            style={styles.iconBtn}
          >
            {markingAll ? (
              <ActivityIndicator size="small" color={palette.playSelectedInk} />
            ) : (
              <CheckReadIcon
                size={22}
                color={palette.playSelectedInk}
                strokeWidth={1.75}
              />
            )}
          </Pressable>
        ) : (
          <View style={styles.iconSpacer} />
        )}
      </View>

      <View style={styles.tabsPad}>
        <SlidingTabs
          variant="underline"
          value={activeTab}
          onChange={(next) => onTabChange(next as NotificationInboxTab)}
          accessibilityLabel={t("tabs_label")}
          items={[
            { id: "ALL", label: t("tab_all") },
            { id: "UNREAD", label: t("tab_unread") },
          ]}
        />
      </View>
    </View>
  );
}

export function NotificationsEmpty({ unreadTab }: { unreadTab: boolean }) {
  const t = useTranslations("notifications");

  return (
    <View style={styles.emptyWrap}>
      <Image source={art.puhuDefault} style={styles.emptyMascot} resizeMode="contain" />
      <AppText style={styles.emptyTitle}>
        {t(unreadTab ? "empty_unread_title" : "empty_title")}
      </AppText>
      <AppText variant="body" tone="secondary" style={styles.emptyBody}>
        {t(unreadTab ? "empty_unread_body" : "empty_body")}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  topChrome: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBar: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    gap: 4,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  iconSpacer: {
    width: 44,
    height: 44,
  },
  titleRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "800",
  },
  unreadBadge: {
    minWidth: 24,
    height: 24,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  tabsPad: {
    paddingHorizontal: 20,
  },
  emptyWrap: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 40,
    gap: 6,
  },
  emptyMascot: {
    width: 64,
    height: 64,
    marginBottom: 6,
  },
  emptyTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "800",
    textAlign: "center",
  },
  emptyBody: {
    textAlign: "center",
  },
});
