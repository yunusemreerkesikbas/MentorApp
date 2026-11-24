import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { careerArt, recapArt } from "../../lib/art.js";
import { useAuth } from "../../providers/auth-provider.js";
import { useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { Button } from "../ui/index.js";
import { AppText } from "../ui/text.js";

export interface RecapMessageAction {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary";
}

/** A quiet week or a failed load (the web shell's `RecapMessageState`): Puhu, a line, a way on. */
export function RecapMessageState({
  title,
  message,
  actions,
  onExit,
}: {
  title: string;
  message: string;
  actions: RecapMessageAction[];
  onExit: () => void;
}) {
  const t = useTranslations("recap");
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { palette } = useThemeTokens();
  const puhu = user?.careerGroup ? careerArt[user.careerGroup] : recapArt.puhu.encouraging;

  return (
    <ScrollView
      style={{ backgroundColor: palette.bg }}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 40 },
      ]}
    >
      <Image source={puhu} style={styles.puhu} contentFit="contain" accessible={false} />
      <View style={styles.copy}>
        <AppText accessibilityRole="header" style={[styles.title, { color: palette.main }]}>
          {title}
        </AppText>
        {message ? (
          <AppText tone="secondary" style={styles.message}>
            {message}
          </AppText>
        ) : null}
      </View>
      <View style={styles.actions}>
        {actions.map((action) => (
          <Button
            key={action.label}
            label={action.label}
            variant={action.variant ?? "primary"}
            onPress={action.onPress}
          />
        ))}
      </View>
      <Pressable accessibilityRole="button" onPress={onExit} style={styles.exit}>
        <AppText variant="caption" tone="secondary" style={styles.exitLabel}>
          {t("exit")}
        </AppText>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 24,
    paddingHorizontal: 20,
  },
  puhu: {
    width: 120,
    height: 120,
  },
  copy: {
    alignItems: "center",
    gap: 12,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "700",
    textAlign: "center",
  },
  message: {
    fontSize: 16,
    lineHeight: 28,
    textAlign: "center",
  },
  actions: {
    alignSelf: "stretch",
    gap: 12,
  },
  exit: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  exitLabel: {
    fontSize: 14,
    fontWeight: "700",
    textDecorationLine: "underline",
  },
});
