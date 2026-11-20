import type { ReactNode } from "react";
import { Image } from "expo-image";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { AltArrowLeftIcon } from "@solar-icons/react-native/linear/alt-arrow-left";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { authHangArt } from "../../lib/art.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { AmbientBackdrop } from "../ui/ambient-backdrop.js";
import { AppText } from "../ui/index.js";

// The web sprite's hands meet the sheet at row 160 of its 384px canvas.
const HANG_SIZE = 176;
const HANG_OVERHANG = Math.round((HANG_SIZE * 160) / 384);

export type AuthFormPose = keyof typeof authHangArt;

export function AuthFormScreen({ title, subtitle, pose, back, children }: {
  title: string;
  subtitle?: string;
  pose?: AuthFormPose;
  back?: { label: string; onPress: () => void };
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const { palette, radii, space, touchTargets } = useThemeTokens();

  return (
    <View style={{ flex: 1 }}>
      <AmbientBackdrop />
      <ScrollView
        contentInsetAdjustmentBehavior="never"
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1 }}
        contentContainerStyle={{
          flexGrow: 1, justifyContent: "flex-end",
          paddingTop: insets.top + (pose ? HANG_OVERHANG : space.lg),
        }}
      >
        <View style={{
          backgroundColor: palette.surface,
          borderTopLeftRadius: radii.button, borderTopRightRadius: radii.button,
          paddingHorizontal: space.xl, paddingTop: space.sm,
          paddingBottom: Math.max(space["2xl"], insets.bottom + space.sm),
          gap: space.lg,
        }}>
          {pose ? (
            <View pointerEvents="none" style={styles.hang}>
              <Image source={authHangArt[pose]} style={styles.sprite} contentFit="contain" accessible={false} />
            </View>
          ) : null}
          <View style={[styles.handle, { backgroundColor: palette.border, borderRadius: radii.pill }]} />
          {back ? (
            <Pressable
              accessibilityRole="button" accessibilityLabel={back.label} onPress={back.onPress}
              style={{
                width: touchTargets.min, height: touchTargets.min, alignSelf: "flex-start",
                alignItems: "center", justifyContent: "center",
                backgroundColor: palette.surfaceAlt, borderRadius: radii.pill,
              }}
            >
              <AltArrowLeftIcon color={palette.main} size={22} />
            </Pressable>
          ) : null}
          <View style={{ gap: space.xs }}>
            <AppText accessibilityRole="header" variant="title" style={!back && styles.center}>{title}</AppText>
            {subtitle ? <AppText tone="secondary" style={!back && styles.center}>{subtitle}</AppText> : null}
          </View>
          {children}
        </View>
      </ScrollView>
    </View>
  );
}

export function AuthFormLink({ label, onPress }: { label: string; onPress: () => void }) {
  const { palette, touchTargets } = useThemeTokens();
  return (
    <Pressable accessibilityRole="link" onPress={onPress}
      style={{ minHeight: touchTargets.min, justifyContent: "center" }}>
      <AppText style={{ color: palette.playSelectedInk, fontWeight: "800" }}>{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { textAlign: "center" },
  hang: {
    position: "absolute", top: -HANG_OVERHANG, left: 0, right: 0,
    alignItems: "center", zIndex: 1,
  },
  sprite: { width: HANG_SIZE, height: HANG_SIZE },
  handle: { width: 36, height: 4, alignSelf: "center" },
});
