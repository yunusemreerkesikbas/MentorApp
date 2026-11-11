import { StyleSheet, View } from "react-native";
import { Slot } from "expo-router";
import { RoleTabBar } from "../../../components/navigation/role-tab-bar.js";
import { useThemeTokens } from "../../../providers/theme-provider.js";

export default function TabsShellLayout() {
  const { palette } = useThemeTokens();

  return (
    <View style={[styles.shell, { backgroundColor: palette.bg }]}>
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
