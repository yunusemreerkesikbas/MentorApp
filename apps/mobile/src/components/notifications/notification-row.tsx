import { Pressable, StyleSheet, View } from "react-native";
import { ChatRoundDotsIcon } from "@solar-icons/react-native/linear/chat-round-dots";
import { ChecklistMinimalisticIcon } from "@solar-icons/react-native/linear/checklist-minimalistic";
import { CupStarIcon } from "@solar-icons/react-native/linear/cup-star";
import { DocumentTextIcon } from "@solar-icons/react-native/linear/document-text";
import { MenuDotsIcon } from "@solar-icons/react-native/linear/menu-dots";
import { StarsIcon } from "@solar-icons/react-native/linear/stars";
import { UserRoundedIcon } from "@solar-icons/react-native/linear/user-rounded";
import { VolumeLoudIcon } from "@solar-icons/react-native/linear/volume-loud";
import type { NotificationCategory, UserNotificationDto } from "@mentor/types";
import { mixHex } from "../../lib/layout.js";
import { formatNotificationTime } from "../../lib/notifications-view.js";
import { useLocale, useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { AppText } from "../ui/index.js";

function CategoryGlyph({ category }: { category: NotificationCategory }) {
  const { palette } = useThemeTokens();

  switch (category) {
    case "COACH":
      return <StarsIcon size={22} color={palette.chipText} strokeWidth={1.75} />;
    case "PLAN":
      return <ChecklistMinimalisticIcon size={22} color={palette.secondary} strokeWidth={1.75} />;
    case "CONTENT":
      return <DocumentTextIcon size={22} color={palette.secondary} strokeWidth={1.75} />;
    case "FORUM":
      return <ChatRoundDotsIcon size={22} color={palette.secondary} strokeWidth={1.75} />;
    case "ACHIEVEMENT":
      return (
        <CupStarIcon
          size={22}
          color={mixHex(palette.streak, palette.main, 0.75)}
          strokeWidth={1.75}
        />
      );
    case "MENTORSHIP":
      return <UserRoundedIcon size={22} color={palette.coachAccent} strokeWidth={1.75} />;
    case "SYSTEM":
      return <VolumeLoudIcon size={22} color={palette.secondary} strokeWidth={1.75} />;
  }
}

export function NotificationRow({
  item,
  onPress,
  onOpenActions,
}: {
  item: UserNotificationDto;
  onPress: () => void;
  onOpenActions: () => void;
}) {
  const { palette } = useThemeTokens();
  const { locale } = useLocale();
  const t = useTranslations("notifications");
  const isUnread = item.readAt === null;

  const rowBg = isUnread
    ? mixHex(palette.playSelected, palette.surface, 0.45)
    : palette.surface;
  const pressedBg = isUnread
    ? mixHex(palette.playSelected, palette.surface, 0.7)
    : mixHex(palette.main, palette.surface, 0.04);

  const formattedTime = formatNotificationTime(item.createdAt, locale, {
    timeJustNow: t("time_just_now"),
    timeHoursAgo: (count) => t("time_hours_ago", { count }),
    timeYesterday: t("time_yesterday"),
    timeDaysAgo: (count) => t("time_days_ago", { count }),
  });

  return (
    <View style={[styles.outer, { borderBottomColor: palette.playLine, backgroundColor: rowBg }]}>
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [
          styles.mainPress,
          pressed ? { backgroundColor: pressedBg } : null,
        ]}
      >
        <View style={styles.iconSlot}>
          <CategoryGlyph category={item.category} />
        </View>

        <View style={styles.textCol}>
          <AppText
            numberOfLines={2}
            style={[
              styles.title,
              {
                color: palette.main,
                fontWeight: isUnread ? "800" : "700",
              },
            ]}
          >
            {item.title}
          </AppText>
          <AppText
            numberOfLines={2}
            style={[styles.body, { color: palette.secondary }]}
          >
            {item.body}
          </AppText>
        </View>

        <View style={styles.metaCol}>
          <AppText
            numberOfLines={1}
            style={[styles.time, { color: palette.secondary }]}
          >
            {formattedTime}
          </AppText>
          {isUnread ? (
            <View style={[styles.unreadDot, { backgroundColor: palette.ctaPlayBg }]} />
          ) : null}
        </View>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("row_actions_label")}
        hitSlop={4}
        onPress={onOpenActions}
        style={({ pressed }) => [
          styles.moreBtn,
          pressed ? { backgroundColor: pressedBg } : null,
        ]}
      >
        <MenuDotsIcon size={20} color={palette.secondary} strokeWidth={1.75} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingLeft: 20,
    paddingRight: 8,
  },
  mainPress: {
    flex: 1,
    minHeight: 68,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 12,
    gap: 12,
  },
  iconSlot: {
    width: 24,
    height: 24,
    marginTop: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  textCol: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  title: {
    fontSize: 14,
    lineHeight: 19,
  },
  body: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "600",
  },
  metaCol: {
    alignItems: "flex-end",
    gap: 6,
    paddingTop: 2,
    maxWidth: 96,
  },
  time: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  moreBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
});
