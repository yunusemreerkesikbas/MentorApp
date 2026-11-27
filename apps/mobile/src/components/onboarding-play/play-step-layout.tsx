import type { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AltArrowLeftIcon } from "@solar-icons/react-native/linear/alt-arrow-left";
import { haptics } from "../../lib/haptics.js";
import { useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { AppText } from "../ui/index.js";
import { PlayProgress } from "./play-progress.js";

/**
 * The web's `OnboardingStepLayout`: back · progress pill · skip on top, the question (Puhu's bubble
 * or a title), the answers, and a footer that stays above the home indicator.
 */
export function PlayStepLayout({
  progress, onBack, skipLabel, onSkip, heading, children, footer, busy = false,
}: {
  progress: { done: number; total: number } | null;
  onBack?: () => void;
  skipLabel?: string;
  onSkip?: () => void;
  heading: ReactNode;
  children?: ReactNode;
  footer: ReactNode;
  /** While the step saves, back and skip wait so the save cannot land on another step. */
  busy?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const { palette, space } = useThemeTokens();
  const t = useTranslations("play");
  return (
    <View style={[styles.root, { backgroundColor: palette.bg, paddingTop: insets.top + space.sm }]}>
      <View style={[styles.top, { paddingHorizontal: space.lg }]}>
        {onBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("back_aria")}
            accessibilityState={{ disabled: busy }}
            disabled={busy}
            hitSlop={8}
            onPress={() => {
              haptics.selection();
              onBack();
            }}
            style={[styles.icon, busy && styles.busy]}
          >
            <AltArrowLeftIcon size={24} color={palette.secondary} />
          </Pressable>
        ) : null}
        {progress ? <PlayProgress done={progress.done} total={progress.total} label={t("progress_aria", { current: progress.done, total: progress.total })} /> : <View style={styles.flex} />}
        {onSkip && skipLabel ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={skipLabel}
            accessibilityState={{ disabled: busy }}
            disabled={busy}
            hitSlop={8}
            onPress={() => {
              haptics.selection();
              onSkip();
            }}
            style={[styles.skip, busy && styles.busy]}
          >
            <AppText style={[styles.skipText, { color: palette.secondary }]}>{skipLabel}</AppText>
          </Pressable>
        ) : onBack ? <View style={styles.icon} /> : null}
      </View>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: space.lg, paddingTop: space.lg, paddingBottom: space.lg, gap: space.xl }}
      >
        {heading}
        {children}
      </ScrollView>
      <View style={{ paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: Math.max(insets.bottom, space.lg) + space.sm, gap: space.md }}>
        {footer}
      </View>
    </View>
  );
}

/** A save error sits right above the button it belongs to. */
export function PlayError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <AppText tone="danger" accessibilityRole="alert" style={styles.error}>{message}</AppText>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  top: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 12 },
  icon: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  skip: { minHeight: 44, justifyContent: "center", paddingHorizontal: 4 },
  busy: { opacity: 0.4 },
  skipText: { fontSize: 14, fontWeight: "800" },
  error: { fontSize: 14, lineHeight: 20, fontWeight: "600" },
});
