import type { ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MentorshipStackBar } from "../mentorship/coach-identity-badges.js";
import { useThemeTokens } from "../../providers/theme-provider.js";

export function VisionScreen({ title, children }: { title: string; children: ReactNode }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { palette, space } = useThemeTokens();
  return <View style={{ flex: 1, backgroundColor: palette.bg }}>
    <MentorshipStackBar title={title} onBack={() => router.canGoBack() ? router.back() : router.replace("/(app)/(tabs)/dashboard")} />
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{
      gap: space.lg, padding: space.lg, paddingBottom: insets.bottom + space["2xl"],
    }}>{children}</ScrollView>
  </View>;
}

export function Wrap({ children }: { children: ReactNode }) {
  const { space } = useThemeTokens();
  return <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>{children}</View>;
}
