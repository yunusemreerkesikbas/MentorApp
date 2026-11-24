import { useState } from "react";
import { ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BellIcon } from "@solar-icons/react-native/linear/bell";
import { isCoach } from "@mentor/core";
import { http } from "@mentor/api-client";
import { FormSheet, PanelCard, PanelCardTitle } from "../../../components/panel/primitives.js";
import { ExamSwitcherCard } from "../../../components/settings/exam-switcher-card.js";
import { FriendInviteCard } from "../../../components/settings/friend-invite-card.js";
import { MyCoachCard } from "../../../components/settings/my-coach-card.js";
import { PhoneVerificationCard } from "../../../components/settings/phone-verification-card.js";
import { SettingsIdentity } from "../../../components/settings/settings-identity.js";
import { SettingsRow } from "../../../components/settings/settings-row.js";
import { AppText, Chip } from "../../../components/ui/index.js";
import { ConfirmDialog } from "../../../components/ui/confirm-dialog.js";
import { errorText } from "../../../lib/plan-view.js";
import { useToast } from "../../../providers/toast-provider.js";
import { useAuth } from "../../../providers/auth-provider.js";
import { useLocale, useTranslations } from "../../../providers/i18n-provider.js";
import { tabBarClearance } from "../../../lib/layout.js";
import { useThemeTokens } from "../../../providers/theme-provider.js";

const themes = ["light", "dark", "system"] as const;
const languages = [{ value: "tr", label: "Türkçe (TR)" }, { value: "en", label: "English (EN)" }] as const;

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const { palette, space, preference, setThemePreference } = useThemeTokens();
  const { locale, setLocale } = useLocale();
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");
  const [sheet, setSheet] = useState<"theme" | "language" | null>(null);
  const toast = useToast();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Store rule (Play + App Store): in-app account deletion. Same call and copy as the web's
  // account-links-card; the server revokes every session, so logout only clears the local one.
  async function deleteAccount() {
    setDeleteOpen(false);
    setDeleting(true);
    try {
      await http<void>("/v1/account", { method: "DELETE" });
    } catch (error) {
      setDeleting(false);
      toast.show(errorText(error, t("delete_account_error")));
      return;
    }
    await logout().catch(() => undefined);
    router.replace("/(auth)/welcome" as never);
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      style={{ flex: 1, backgroundColor: palette.bg }}
      contentContainerStyle={{
        paddingTop: space.lg,
        paddingBottom: tabBarClearance(insets.bottom),
        paddingHorizontal: space.lg,
        gap: space.xl,
      }}
    >
      {user ? <SettingsIdentity user={user} /> : <AppText accessibilityRole="header" variant="title">{t("title")}</AppText>}
      <PanelCard style={{ padding: space.sm }}>
        <View style={{ paddingHorizontal: space.sm, paddingTop: space.xs }}>
          <PanelCardTitle>{t("appearance_section")}</PanelCardTitle>
        </View>
        <SettingsRow label={t("theme_label")} detail={t(`theme_${preference}`)} onPress={() => setSheet("theme")} />
        <SettingsRow label={t("language_label")} detail={languages.find((choice) => choice.value === locale)?.label}
          onPress={() => setSheet("language")} />
      </PanelCard>

      {user ? <ExamSwitcherCard user={user} /> : null}
      {user ? <PhoneVerificationCard /> : null}
      {user && !isCoach(user) ? <MyCoachCard /> : null}
      {user && !isCoach(user) ? <FriendInviteCard /> : null}

      {user ? (
        <PanelCard style={{ padding: space.sm }}>
          <View style={{ paddingHorizontal: space.sm, paddingTop: space.xs }}>
            <PanelCardTitle>{t("account_section")}</PanelCardTitle>
          </View>
          <SettingsRow label={t("notifications_cta")} icon={<BellIcon size={21} color={palette.secondary} />}
            onPress={() => router.push("/(app)/notifications" as never)} />
          <SettingsRow label={t("logout_cta")} danger onPress={() => {
            void logout().then(() => router.replace("/(auth)/welcome" as never));
          }} />
          <SettingsRow label={deleting ? t("delete_account_deleting") : t("delete_account_cta")} danger
            onPress={() => { if (!deleting) setDeleteOpen(true); }} />
        </PanelCard>
      ) : null}

      <ConfirmDialog
        visible={deleteOpen}
        title={t("delete_account_title")}
        message={t("delete_account_body")}
        confirmLabel={t("delete_account_confirm")}
        cancelLabel={t("delete_account_cancel")}
        destructive
        onConfirm={() => void deleteAccount()}
        onCancel={() => setDeleteOpen(false)}
      />

      {sheet ? (
        <FormSheet visible title={t(`${sheet}_label`)} closeLabel={tCommon("close")} onClose={() => setSheet(null)}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
            {sheet === "theme" ? themes.map((choice) => (
              <Chip key={choice} label={t(`theme_${choice}`)} selected={preference === choice} onPress={() => {
                setThemePreference(choice);
                setSheet(null);
              }} />
            )) : languages.map(({ value, label }) => (
              <Chip key={value} label={label} selected={locale === value} onPress={() => {
                setLocale(value);
                setSheet(null);
              }} />
            ))}
          </View>
        </FormSheet>
      ) : null}
    </ScrollView>
  );
}
