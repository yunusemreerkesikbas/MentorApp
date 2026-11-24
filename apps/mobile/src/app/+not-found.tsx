import { View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText, Button } from "../components/ui/index.js";
import { useTranslations } from "../providers/i18n-provider.js";
import { useThemeTokens } from "../providers/theme-provider.js";

/** Any link the app has no screen for (an old link, a web-only page) lands here, not on Expo's English default. */
export default function NotFoundScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { palette, space } = useThemeTokens();
  const t = useTranslations("common");

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: palette.bg,
        paddingTop: insets.top + space.xl,
        paddingBottom: insets.bottom + space.lg,
        paddingHorizontal: space.lg,
      }}
    >
      <View style={{ flex: 1, justifyContent: "center", gap: space.sm }}>
        <AppText variant="title" accessibilityRole="header">
          {t("not_found_title")}
        </AppText>
        <AppText variant="body" tone="secondary">
          {t("not_found_body")}
        </AppText>
      </View>
      <Button label={t("not_found_cta")} onPress={() => router.replace("/")} />
    </View>
  );
}
