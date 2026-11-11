import { Pressable, StyleSheet, View } from "react-native";
import { usePathname, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  getMobileTabItemsForRole,
  isElevatedNavHref,
  isNavActive,
  type AppNavIconId,
} from "@mentor/core";
import { haptics } from "../../lib/haptics.js";
import { useAuth } from "../../providers/auth-provider.js";
import { useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { AppText } from "../ui/text.js";

const GLYPH_MAP: Record<AppNavIconId, string> = {
  home: "⌂",
  plan: "▤",
  coach: "◉",
  analysis: "↗",
  notebook: "❐",
  community: "◈",
  students: "✦",
  coachProfile: "◎",
  settings: "⚙",
};

/**
 * Role-aware bottom tab bar (`DESIGN.md` §4 & §6):
 * - Consumes `getMobileTabItemsForRole` from `@mentor/core` so Student and Coach roles
 *   automatically receive their 5-item pill with the raised center companion/workspace action.
 * - Minimum 44x44pt touch target, safe-area inset aware, haptic selection feedback.
 */
export function RoleTabBar() {
  const { user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { palette, radii, space, touchTargets, ledge } = useThemeTokens();
  const tNav = useTranslations("nav");

  const items = getMobileTabItemsForRole(user?.roles);

  return (
    <View
      style={[
        styles.wrapper,
        {
          paddingBottom: Math.max(insets.bottom, space.sm),
          paddingHorizontal: space.md,
          paddingTop: space.xs,
          backgroundColor: palette.bg,
          borderTopColor: palette.border,
        },
      ]}
    >
      <View
        style={[
          styles.pillContainer,
          {
            backgroundColor: palette.surface,
            borderColor: palette.border,
            borderRadius: radii.card,
            minHeight: touchTargets.tabBarHeight,
            paddingHorizontal: space.xs,
          },
        ]}
      >
        {items.map((item) => {
          const active = isNavActive(pathname, item.href);
          const elevated = isElevatedNavHref(item.href);
          const label = tNav(item.labelKey as Parameters<typeof tNav>[0]);

          return (
            <Pressable
              key={item.href}
              accessibilityRole="tab"
              accessibilityLabel={label}
              accessibilityState={{ selected: active }}
              onPress={() => {
                if (active) return;
                haptics.selection();
                router.replace(item.href as never);
              }}
              style={[
                styles.tabButton,
                {
                  minHeight: touchTargets.comfortable,
                },
              ]}
            >
              <View
                style={[
                  elevated ? styles.elevatedPill : styles.standardPill,
                  elevated
                    ? {
                        backgroundColor: active ? palette.ctaPlayBg : palette.surfaceAlt,
                        borderColor: active ? palette.ctaPlayEdge : palette.border,
                        borderBottomWidth: ledge.secondaryBottomWidth,
                        borderRadius: radii.pill,
                      }
                    : {
                        backgroundColor: active ? palette.surfaceAlt : "transparent",
                        borderRadius: radii.inner,
                      },
                ]}
              >
                <AppText
                  variant="cardTitle"
                  style={{
                    color: elevated && active
                      ? palette.ctaPlayInk
                      : active
                        ? palette.main
                        : palette.secondary,
                  }}
                >
                  {GLYPH_MAP[item.icon]}
                </AppText>
                <AppText
                  variant="micro"
                  numberOfLines={1}
                  style={{
                    color: elevated && active
                      ? palette.ctaPlayInk
                      : active
                        ? palette.main
                        : palette.muted,
                  }}
                >
                  {label}
                </AppText>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderTopWidth: 1,
  },
  pillContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderCurve: "continuous",
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  standardPill: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 2,
    borderCurve: "continuous",
  },
  elevatedPill: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    gap: 2,
    transform: [{ translateY: -4 }],
    borderCurve: "continuous",
  },
});
