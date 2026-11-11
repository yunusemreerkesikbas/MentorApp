import { ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { isCoach } from "@mentor/core";
import { ExamSwitcherCard } from "../../../components/settings/exam-switcher-card.js";
import { FriendInviteCard } from "../../../components/settings/friend-invite-card.js";
import { MyCoachCard } from "../../../components/settings/my-coach-card.js";
import { PhoneVerificationCard } from "../../../components/settings/phone-verification-card.js";
import { Button, Card, Chip, AppText } from "../../../components/ui/index.js";
import { useAuth } from "../../../providers/auth-provider.js";
import { useLocale, useTranslations } from "../../../providers/i18n-provider.js";
import { useThemeTokens } from "../../../providers/theme-provider.js";

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const { palette, space, preference, setThemePreference } = useThemeTokens();
  const { locale, setLocale } = useLocale();
  const t = useTranslations("settings");

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      style={{ flex: 1, backgroundColor: palette.bg }}
      contentContainerStyle={{
        paddingTop: insets.top + space.lg,
        paddingBottom: space.xl,
        paddingHorizontal: space.lg,
        gap: space.lg,
      }}
    >
      <View style={{ gap: 2 }}>
        <AppText variant="title">{t("title")}</AppText>
        {user ? (
          <AppText variant="caption" tone="secondary">
            {user.displayName} {user.username ? `· @${user.username}` : ""}
          </AppText>
        ) : null}
      </View>

      {user ? <ExamSwitcherCard user={user} /> : null}

      {user && !isCoach(user) ? <MyCoachCard /> : null}

      {user && !isCoach(user) ? <FriendInviteCard /> : null}

      {user ? <PhoneVerificationCard /> : null}

      {user ? (
        <Button
          label={t("notifications_cta")}
          variant="secondary"
          onPress={() => router.push("/(app)/notifications" as never)}
        />
      ) : null}

      <Card style={{ gap: space.md }}>
        <AppText variant="sectionHeading">{t("theme_label")}</AppText>
        <View style={styles.chipRow}>
          <Chip
            label={t("theme_light")}
            selected={preference === "light"}
            onPress={() => setThemePreference("light")}
          />
          <Chip
            label={t("theme_dark")}
            selected={preference === "dark"}
            onPress={() => setThemePreference("dark")}
          />
          <Chip
            label={t("theme_system")}
            selected={preference === "system"}
            onPress={() => setThemePreference("system")}
          />
        </View>
      </Card>

      <Card style={{ gap: space.md }}>
        <AppText variant="sectionHeading">{t("language_label")}</AppText>
        <View style={styles.chipRow}>
          <Chip
            label="Türkçe (TR)"
            selected={locale === "tr"}
            onPress={() => setLocale("tr")}
          />
          <Chip
            label="English (EN)"
            selected={locale === "en"}
            onPress={() => setLocale("en")}
          />
        </View>
      </Card>

      {user ? (
        <Button
          label={t("logout_cta")}
          variant="danger"
          onPress={() => {
            void logout().then(() => {
              router.replace("/(auth)/welcome" as never);
            });
          }}
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
});
