import { Pressable, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Path } from "react-native-svg";
import { BellIcon } from "@solar-icons/react-native/linear/bell";
import { UserIcon } from "@solar-icons/react-native/bold/user";
import { greetingKeyForHour, isCoach } from "@mentor/core";
import { fetchEconomyBalance } from "../../lib/coaching-api.js";
import { APP_HEADER_HEIGHT, mixHex } from "../../lib/layout.js";
import { listNotifications } from "../../lib/notifications-api.js";
import { PREMIUM_MASK_EYES, PREMIUM_MASK_OUTLINE, useIsPremium } from "../../lib/premium.js";
import { useAuth } from "../../providers/auth-provider.js";
import { useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { AppText } from "../ui/text.js";
import { ThemeLamp } from "./theme-lamp.js";

const AVATAR_SIZE = 44;

/**
 * The app's top bar on tab screens, from the web's phone header (`app-nav.tsx`): avatar and
 * greeting on the left; Coin and XP pills, the theme lamp and the notification bell on the right.
 */
export function AppHeader() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { palette } = useThemeTokens();
  const t = useTranslations("nav");
  const tPanel = useTranslations("panel");
  const premium = useIsPremium();

  const coachRole = isCoach(user);

  const balanceQuery = useQuery({
    queryKey: ["economy", "balance"],
    queryFn: fetchEconomyBalance,
    enabled: Boolean(user) && !coachRole,
  });
  const unreadQuery = useQuery({
    queryKey: ["notifications", "unread"],
    queryFn: async () => (await listNotifications()).unreadCount,
  });
  const balance = balanceQuery.data ?? null;
  const unread = unreadQuery.data ?? 0;

  return (
    <View
      style={[
        styles.bar,
        {
          paddingTop: insets.top,
          backgroundColor: palette.surface,
          borderBottomColor: palette.border,
        },
      ]}
    >
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("profile_link")}
          onPress={() => {
            if (router.canDismiss()) {
              router.dismissAll();
            }
            router.replace("/settings" as never);
          }}
          style={[styles.avatar, { backgroundColor: palette.surfaceAlt, borderColor: palette.border }]}
        >
          {user?.avatarUrl ? (
            <Image source={{ uri: user.avatarUrl }} style={styles.avatarImage} contentFit="cover" />
          ) : (
            <UserIcon size={26} color={palette.muted} />
          )}
        </Pressable>

        <View style={styles.identity}>
          <AppText variant="sectionHeading" numberOfLines={1} style={styles.greeting}>
            {t(greetingKeyForHour())}
          </AppText>
          {user ? (
            <View style={styles.nameRow}>
              <AppText variant="body" tone="secondary" numberOfLines={1} style={styles.name}>
                {user.displayName}
              </AppText>
              {premium ? (
                // 16dp, so the mask alone: the gold eye rims would blur under a pixel (DESIGN.md §7).
                <Svg
                  width={16}
                  height={16}
                  viewBox="0 0 24 24"
                  accessibilityRole="image"
                  accessibilityLabel={tPanel("premium_member")}
                >
                  <Path
                    fill={palette.premiumMark}
                    fillRule="evenodd"
                    d={PREMIUM_MASK_OUTLINE + PREMIUM_MASK_EYES}
                  />
                </Svg>
              ) : null}
            </View>
          ) : null}
        </View>

        <View style={styles.actions}>
          {!coachRole && balance ? (
            <View accessibilityLabel={t("earned_rights_label")} style={styles.pills}>
              <Pill
                value={balance.coinConfirmed}
                background={mixHex(palette.progressTrack, palette.surface, 0.4)}
                ink={palette.main}
                icon={<CoinsGlyph color={palette.progress} />}
              />
              <Pill
                value={balance.xp}
                background={mixHex(palette.star, palette.surface, 0.3)}
                ink={palette.main}
                icon={<GemGlyph color={mixHex(palette.star, palette.main, 0.6)} />}
              />
            </View>
          ) : null}
          <ThemeLamp />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              unread > 0 ? t("notifications_unread_label", { count: unread }) : t("notifications_label")
            }
            onPress={() => router.push("/(app)/notifications" as never)}
            style={styles.bell}
          >
            <BellIcon size={24} color={palette.main} strokeWidth={1.75} />
            {unread > 0 ? (
              <View style={[styles.badge, { backgroundColor: palette.ctaPlayBg, borderColor: palette.surface }]}>
                <AppText variant="micro" tabularNums style={{ color: palette.ctaPlayInk, fontWeight: "800" }}>
                  {unread > 9 ? "9+" : String(unread)}
                </AppText>
              </View>
            ) : null}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function Pill({
  value,
  background,
  ink,
  icon,
}: {
  value: number;
  background: string;
  ink: string;
  icon: React.ReactNode;
}) {
  return (
    <View style={[styles.pill, { backgroundColor: background }]}>
      {icon}
      <AppText variant="micro" tabularNums style={{ color: ink, fontWeight: "700" }}>
        {formatCompact(value)}
      </AppText>
    </View>
  );
}

/** 1.250 → "1,3 B", like the web's `Intl` compact notation, without relying on Hermes' Intl data. */
function formatCompact(value: number): string {
  if (value < 1000) return String(value);
  const scaled = value < 1_000_000 ? value / 1000 : value / 1_000_000;
  const text = scaled.toFixed(1).replace(".0", "").replace(".", ",");
  return `${text} ${value < 1_000_000 ? "B" : "Mn"}`;
}

// The web draws these two with lucide (`Coins`, `Gem`); two inline glyphs beat a second icon set.
export function CoinsGlyph({ color, size = 14 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx={8} cy={8} r={6} />
      <Path d="M18.09 10.37A6 6 0 1 1 10.34 18" />
      <Path d="M7 6h1v4" />
      <Path d="m16.71 13.88.7.71-2.82 2.82" />
    </Svg>
  );
}

function GemGlyph({ color }: { color: string }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M6 3h12l4 6-10 13L2 9Z" />
      <Path d="M11 3 8 9l4 13 4-13-3-6" />
      <Path d="M2 9h20" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  // Above the screen content, so Puhu can hang from the lamp over the page.
  bar: {
    borderBottomWidth: 1,
    zIndex: 2,
  },
  row: {
    height: APP_HEADER_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
  },
  identity: {
    flex: 1,
    minWidth: 0,
  },
  greeting: {
    fontSize: 16,
    lineHeight: 20,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  name: {
    flexShrink: 1,
    lineHeight: 19,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  pills: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 9999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  bell: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: 4,
    right: 2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    paddingHorizontal: 3,
    alignItems: "center",
    justifyContent: "center",
  },
});
