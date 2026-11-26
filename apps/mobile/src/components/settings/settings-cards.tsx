import { useState } from "react";
import { Linking, Pressable, Share, View } from "react-native";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useQuery } from "@tanstack/react-query";
import Svg, { Path } from "react-native-svg";
import { ApiClientError, http } from "@mentor/api-client";
import type { GoogleLinkStatus, MentorshipDataScopeKey } from "@mentor/types";
import { fetchMentorshipOverview } from "../../lib/mentorship-api.js";
import { LEGAL_DOCUMENTS, signupLegalUrl } from "../../lib/signup-legal.js";
import { useLocale, useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { useToast } from "../../providers/toast-provider.js";
import { FormSheet } from "../panel/primitives.js";
import { AppText, SlidingTabs } from "../ui/index.js";
import { SettingsCard, SettingsRow } from "./settings-row.js";

const SITE_URL = "https://puhukoc.com";

/** Store-facing pages open inside the app (owner decision 2026-11-25): one copy of the text, no app switch. */
export const openInApp = (url: string) => void WebBrowser.openBrowserAsync(url).catch(() => Linking.openURL(url));

/** Coach only: the consent contract, read on press (`/v1/mentorship/overview` is `@Roles(COACH)`). */
export function CoachScopeCard() {
  const t = useTranslations("settings");
  const tStudents = useTranslations("students");
  const tCommon = useTranslations("common");
  const toast = useToast();
  const { space } = useThemeTokens();
  const [scope, setScope] = useState<readonly MentorshipDataScopeKey[] | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function show() {
    if (scope) return setOpen(true);
    if (busy) return;
    setBusy(true);
    try {
      setScope((await fetchMentorshipOverview()).dataScope);
      setOpen(true);
    } catch (err) {
      toast.show(err instanceof ApiClientError ? err.message : tCommon("error_body"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SettingsCard title={t("coach_scope_section")}>
      <SettingsRow label={t("coach_scope_title")} description={t("coach_scope_row_body")} onPress={() => void show()} />
      {open && scope ? (
        <FormSheet visible title={t("coach_scope_title")} closeLabel={tCommon("close")} onClose={() => setOpen(false)}>
          <View style={{ gap: space.md }}>
            <AppText variant="body" tone="secondary">{t("coach_scope_subtitle")}</AppText>
            <View style={{ gap: space.xs }}>
              {scope.map((key) => (
                <AppText key={key} variant="body">• {tStudents(`coach_scope_${key}` as "coach_scope_ACTIVITY")}</AppText>
              ))}
            </View>
            <AppText variant="sectionHeading">{t("coach_scope_writes_title")}</AppText>
            <AppText variant="body" tone="secondary">{t("coach_scope_writes")}</AppText>
            <AppText variant="sectionHeading">{t("coach_scope_never_title")}</AppText>
            <AppText variant="body" tone="secondary">{tStudents("coach_scope_never_body")}</AppText>
          </View>
        </FormSheet>
      ) : null}
    </SettingsCard>
  );
}

function GoogleLogo() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" accessible={false}>
      <Path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <Path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <Path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.48 12c0-.73.13-1.43.36-2.1V7.06H2.18A10.94 10.94 0 0 0 1 12c0 1.77.42 3.45 1.18 4.94l3.66-2.84z" />
      <Path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06L5.84 9.9C6.71 7.31 9.14 5.38 12 5.38z" />
    </Svg>
  );
}

/**
 * Status only (owner decision 2026-11-25): linking needs the password step and the OAuth return,
 * which land on the web, so an unlinked row opens the web settings in the in-app browser.
 */
export function GoogleAccountCard() {
  const t = useTranslations("settings");
  const { locale } = useLocale();
  const query = useQuery({
    queryKey: ["auth-accounts", "google"],
    queryFn: async () => (await http<GoogleLinkStatus>("/v1/users/me/auth-accounts/google")) as GoogleLinkStatus,
  });
  const status = query.data;
  if (!status || (!status.enabled && !status.linked)) return null;

  return (
    <SettingsCard title={t("google_section")}>
      <SettingsRow label={t("google_title")} icon={<GoogleLogo />}
        description={status.linked ? (status.providerEmail ?? t("google_linked", { email: "" })) : status.canLink ? t("google_connect") : t("google_verify_first")}
        onPress={status.linked || !status.canLink ? undefined : () => openInApp(`${SITE_URL}${locale === "en" ? "/en/settings" : "/ayarlar"}`)} />
    </SettingsCard>
  );
}

const FEEDBACK_URL = process.env.EXPO_PUBLIC_PROFILE_FEEDBACK_URL?.trim() || null;

/** The web's "Uygulama" card: language and theme in-row, recommend, help, feedback. Cookie preferences are web-only. */
export function AppSupportCard() {
  const t = useTranslations("settings");
  const router = useRouter();
  const { locale, setLocale } = useLocale();
  const { mode, setThemePreference } = useThemeTokens();

  return (
    <SettingsCard title={t("support_title")}>
      <SettingsRow label={t("support_language")} chevron={false} trailing={(
        <SlidingTabs compact accessibilityLabel={t("support_language")} value={locale} onChange={setLocale}
          items={[{ id: "tr", label: "TR" }, { id: "en", label: "EN" }]} style={{ width: 112 }} />
      )} />
      <SettingsRow label={t("support_theme")} chevron={false} trailing={(
        <SlidingTabs compact accessibilityLabel={t("support_theme")} value={mode} onChange={setThemePreference}
          items={[{ id: "light", label: t("support_theme_light") }, { id: "dark", label: t("support_theme_dark") }]}
          style={{ width: 132 }} />
      )} />
      <SettingsRow label={t("support_recommend")} chevron={false}
        onPress={() => void Share.share({ message: `${t("support_share_text")} ${SITE_URL}` }).catch(() => undefined)} />
      <SettingsRow label={t("support_help")} onPress={() => router.push("/(app)/knowledge" as never)} />
      {FEEDBACK_URL ? <SettingsRow label={t("support_feedback")} onPress={() => openInApp(FEEDBACK_URL)} /> : null}
    </SettingsCard>
  );
}

const SOCIAL = [
  { id: "youtube", label: "YouTube", short: "YT", href: process.env.EXPO_PUBLIC_MENTOR_YOUTUBE_URL },
  { id: "tiktok", label: "TikTok", short: "TK", href: process.env.EXPO_PUBLIC_MENTOR_TIKTOK_URL },
  { id: "instagram", label: "Instagram", short: "IG", href: process.env.EXPO_PUBLIC_MENTOR_INSTAGRAM_URL },
].filter((link) => link.href?.trim());

/** Same env-driven list as the web; hidden while no account is configured (as on the web today). */
export function SocialFollowCard() {
  const t = useTranslations("settings");
  const { palette, radii } = useThemeTokens();
  if (SOCIAL.length === 0) return null;
  return (
    <SettingsCard title={t("social_title")}>
      {SOCIAL.map((link) => (
        <SettingsRow key={link.id} label={link.label} onPress={() => void Linking.openURL(link.href!.trim())}
          icon={(
            <View style={{ width: 28, height: 28, borderRadius: radii.inner, alignItems: "center", justifyContent: "center", backgroundColor: palette.surfaceAlt }}>
              <AppText variant="caption" style={{ fontWeight: "700" }}>{link.short}</AppText>
            </View>
          )} />
      ))}
    </SettingsCard>
  );
}

/** The web's `SettingsLegalFooter`: six documents inline with `·`, opened in the in-app browser. */
export function LegalLinks() {
  const t = useTranslations("settings");
  const { locale } = useLocale();
  const { space } = useThemeTokens();
  return (
    <View accessibilityRole="summary" accessibilityLabel={t("legal_heading")}
      style={{ flexDirection: "row", flexWrap: "wrap", paddingHorizontal: space.md }}>
      {LEGAL_DOCUMENTS.map((doc, index) => (
        <View key={doc} style={{ flexDirection: "row", alignItems: "center" }}>
          {/* 44dp tall touch target per link; the row stays one caption line visually. */}
          <Pressable accessibilityRole="link" onPress={() => openInApp(signupLegalUrl(doc, locale))}
            style={{ minHeight: 44, justifyContent: "center" }}>
            <AppText variant="caption" tone="secondary">{t(`legal_${doc}`)}</AppText>
          </Pressable>
          {index < LEGAL_DOCUMENTS.length - 1 ? (
            <AppText variant="caption" tone="secondary" accessible={false} style={{ marginHorizontal: 6 }}>·</AppText>
          ) : null}
        </View>
      ))}
    </View>
  );
}
