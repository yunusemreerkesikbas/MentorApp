import { Linking, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../providers/auth-provider.js";
import { useTranslations } from "../providers/i18n-provider.js";
import { useThemeTokens } from "../providers/theme-provider.js";
import { AppText, Button } from "./ui/index.js";

const WEB_URL = "https://puhukoc.com";

/** Shown to human-coach accounts while `STUDENT_CORE_ONLY` hides the coach workspace on mobile. */
export function CoachOnWebScreen() {
  const insets = useSafeAreaInsets();
  const { logout } = useAuth();
  const { palette, space } = useThemeTokens();
  const t = useTranslations("auth");
  const tSettings = useTranslations("settings");

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
          {t("coach_web_title")}
        </AppText>
        <AppText variant="body" tone="secondary">
          {t("coach_web_body")}
        </AppText>
      </View>
      <View style={{ gap: space.sm }}>
        <Button
          label={t("coach_web_open_cta")}
          onPress={() => void Linking.openURL(WEB_URL)}
        />
        <Button
          label={tSettings("logout_cta")}
          onPress={() => void logout()}
          variant="secondary"
        />
      </View>
    </View>
  );
}
