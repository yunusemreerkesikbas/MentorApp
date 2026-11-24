import { StyleSheet, View } from "react-native";
import { Slot } from "expo-router";
import { AppHeader } from "../../../components/navigation/app-header.js";
import { RoleTabBar } from "../../../components/navigation/role-tab-bar.js";
import { useThemeTokens } from "../../../providers/theme-provider.js";

/**
 * The tab shell: the app's top bar, the screen, and the tab bar floating over the screen's bottom
 * edge. Tab screens pad their content with `tabBarClearance` so the last card clears the bar.
 */
export default function TabsShellLayout() {
  const { palette } = useThemeTokens();

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
