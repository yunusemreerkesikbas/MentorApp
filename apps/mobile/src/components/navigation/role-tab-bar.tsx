import { useEffect, useState } from "react";
import { Keyboard, Pressable, StyleSheet, View } from "react-native";
import { usePathname, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  APP_NAV_ITEMS,
  getMobileTabItemsForRole,
  isElevatedNavHref,
  isNavActive,
} from "@mentor/core";
import { haptics } from "../../lib/haptics.js";
import {
  cardShadow,
  TAB_BAR_HEIGHT,
  TAB_BAR_SIDE_INSET,
  tabBarBottom,
} from "../../lib/layout.js";
import { STUDENT_CORE_ONLY } from "../../lib/release-scope.js";
import { useAuth } from "../../providers/auth-provider.js";
import { useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { NavIcon } from "./nav-icon.js";

const ITEM_SIZE = 44;
/** The web hangs the raised circle 12dp above the pill's top edge (`-top-3`). */
const ELEVATED_OVERHANG = 12;

/**
 * The web's phone tab bar (`MobileTabBar` in `apps/web/src/components/app-nav.tsx`): a floating
 * pill of bare Solar icons, the active one in a soft `play-selected` circle, and the role's home
 * action lifted out of the middle. Icon-only by the owner's choice; every tab keeps its name as
 * the accessibility label.
 */
export function RoleTabBar() {
  const { user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { palette, radii } = useThemeTokens();
  const tNav = useTranslations("nav");
  const keyboardOpen = useKeyboardOpen();

  // With the keyboard up the bar would ride on top of it and cover the field being typed in.
  if (keyboardOpen) return null;

  const roleItems = getMobileTabItemsForRole(user?.roles);
  // Student core: Settings takes the hidden Community slot, so the pill stays at five.
  const items = STUDENT_CORE_ONLY
    ? roleItems.flatMap((item) =>
        item.href === "/community"
          ? APP_NAV_ITEMS.filter((nav) => nav.href === "/settings")
          : [item],
      )
    : roleItems;

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.anchor,
        { left: TAB_BAR_SIDE_INSET, right: TAB_BAR_SIDE_INSET, bottom: tabBarBottom(insets.bottom) },
      ]}
    >
      <View
        accessibilityRole="tablist"
        style={[
          styles.pill,
          cardShadow,
          {
            height: TAB_BAR_HEIGHT,
            borderRadius: radii.pill,
            borderColor: palette.border,
            backgroundColor: palette.surface,
          },
        ]}
      >
        {items.map((item) => {
          const active = isNavActive(pathname, item.href);
          const elevated = isElevatedNavHref(item.href);
          const label = tNav(item.labelKey as Parameters<typeof tNav>[0]);
          const ink = active
            ? palette.playSelectedInk
            : elevated
              ? palette.main
              : palette.secondary;

          return (
            <Pressable
              key={item.href}
              accessibilityRole="tab"
              accessibilityLabel={label}
              accessibilityState={{ selected: active }}
              onPress={() => {
                if (active) return;
                haptics.selection();
                if (router.canDismiss()) {
                  router.dismissAll();
                }
                router.replace(item.href as never);
              }}
              style={styles.tab}
            >
              <View
                // Remounted on selection: Android keeps a square background when a rounded view's
                // fill changes from transparent to a colour in place.
                key={active ? "active" : "rest"}
                style={[
                  styles.well,
                  elevated
                    ? [
                        styles.elevated,
                        cardShadow,
                        { backgroundColor: active ? palette.playSelected : palette.bg },
                      ]
                    : { backgroundColor: active ? palette.playSelected : "transparent" },
                ]}
              >
                <NavIcon icon={item.icon} active={active} color={ink} size={elevated ? 20 : 22} />
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () => setOpen(true));
    const hide = Keyboard.addListener("keyboardDidHide", () => setOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return open;
}

const styles = StyleSheet.create({
  anchor: {
    position: "absolute",
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    paddingHorizontal: 6,
  },
  tab: {
    flex: 1,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  well: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    borderRadius: ITEM_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  // In a centred row a negative top margin moves the box by half its value, hence the doubling.
  elevated: {
    marginTop: -2 * ((TAB_BAR_HEIGHT - ITEM_SIZE) / 2 + ELEVATED_OVERHANG),
  },
});
