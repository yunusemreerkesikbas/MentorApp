import { useCallback } from "react";
import { BackHandler, StyleSheet, View } from "react-native";
import { Slot, useFocusEffect, usePathname, useRouter } from "expo-router";
import { homePathForUser } from "@mentor/core";
import { AppHeader } from "../../../components/navigation/app-header.js";
import { RoleTabBar } from "../../../components/navigation/role-tab-bar.js";
import { useAuth } from "../../../providers/auth-provider.js";
import { useThemeTokens } from "../../../providers/theme-provider.js";

/**
 * The tab shell: the app's top bar, the screen, and the tab bar floating over the screen's bottom
 * edge. Tab screens pad their content with `tabBarClearance` so the last card clears the bar.
 */
export default function TabsShellLayout() {
  const { palette } = useThemeTokens();
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const home = homePathForUser(user);

  useFocusEffect(useCallback(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (pathname === home) BackHandler.exitApp();
      else router.replace(home as never);
      return true;
    });
    return () => subscription.remove();
  }, [home, pathname, router]));

  return (
    <View style={[styles.shell, { backgroundColor: palette.bg }]}>
      <AppHeader />
      <View style={styles.viewport}>
        <Slot />
      </View>
      <RoleTabBar />
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
  },
  viewport: {
    flex: 1,
  },
});
