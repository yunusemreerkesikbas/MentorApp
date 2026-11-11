import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Card, Chip, StateView, AppText } from "../../../../components/ui/index.js";
import { useTranslations } from "../../../../providers/i18n-provider.js";
import { useThemeTokens } from "../../../../providers/theme-provider.js";

/**
 * Coach Profile & Seat Management (`/students/profile` -> `/kocluk/profil`).
 * Uses `--coach-accent` teal (`DESIGN.md` §2.4 & §11).
 */
export default function CoachProfileScreen() {
  const insets = useSafeAreaInsets();
  const { palette, space } = useThemeTokens();
  const t = useTranslations("students");

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1, backgroundColor: palette.bg }}
      contentContainerStyle={{
        paddingTop: insets.top + space.lg,
        paddingBottom: space.xl,
        paddingHorizontal: space.lg,
        gap: space.lg,
      }}
    >
      <View style={{ gap: space.xs }}>
        <Chip label={t("badge")} tone="coach" />
        <AppText variant="title">{t("profile_title")}</AppText>
        <AppText variant="body" tone="secondary">
          {t("profile_subtitle")}
        </AppText>
      </View>

      <Card variant="coach" style={{ gap: space.sm }}>
        <AppText variant="cardTitle" tone="coach">
          {t("profile_empty_title")}
        </AppText>
        <AppText variant="body" tone="secondary">
          {t("profile_empty_body")}
        </AppText>
      </Card>

      <StateView
        title={t("profile_empty_title")}
        body={t("profile_empty_body")}
      />
    </ScrollView>
  );
}
