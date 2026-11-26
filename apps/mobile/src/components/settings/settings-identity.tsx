import { useState } from "react";
import { Image } from "expo-image";
import { ActivityIndicator, Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { UserIcon } from "@solar-icons/react-native/bold/user";
import { VerifiedCheckIcon } from "@solar-icons/react-native/bold/verified-check";
import { LetterUnreadIcon } from "@solar-icons/react-native/bold/letter-unread";
import { PenIcon } from "@solar-icons/react-native/linear/pen";
import { AltArrowRightIcon } from "@solar-icons/react-native/linear/alt-arrow-right";
import Svg, { Path } from "react-native-svg";
import { ApiClientError, usersControllerResendVerificationEmail } from "@mentor/api-client";
import type { AuthUser } from "@mentor/types";
import { cardShadow, mixHex } from "../../lib/layout.js";
import { PREMIUM_MASK_EYES, PREMIUM_MASK_OUTLINE, useIsPremium } from "../../lib/premium.js";
import { useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { useToast } from "../../providers/toast-provider.js";
import { AppText } from "../ui/index.js";

const AVATAR_SIZE = 112;

/** The web's `ProfileHeader`: avatar with the edit pencil, name, @username · email status, community link. */
export function SettingsIdentity({ user, onEdit }: { user: AuthUser; onEdit: () => void }) {
  const t = useTranslations("settings");
  const tPanel = useTranslations("panel");
  const premium = useIsPremium();
  const router = useRouter();
  const toast = useToast();
  const { palette, radii, space } = useThemeTokens();
  const [sending, setSending] = useState(false);

  async function resendVerification() {
    if (sending) return;
    setSending(true);
    try {
      await usersControllerResendVerificationEmail();
      toast.show(t("verification_sent"));
    } catch (err) {
      toast.show(err instanceof ApiClientError ? err.body.message : t("verification_send_error"));
    } finally {
      setSending(false);
    }
  }

  return (
    <View style={{ alignItems: "center", gap: space.sm, paddingTop: space.sm }}>
      <View>
        <View style={[cardShadow, {
          width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: radii.pill, overflow: "hidden",
          alignItems: "center", justifyContent: "center", borderWidth: 2,
          backgroundColor: palette.surfaceAlt, borderColor: palette.border,
        }]}>
          {user.avatarUrl ? (
            <Image source={{ uri: user.avatarUrl }} contentFit="cover" accessible={false}
              style={{ width: "100%", height: "100%" }} />
          ) : <UserIcon size={56} color={palette.muted} />}
        </View>
        {/* 44dp hit area around a 36dp disc, bottom-right like the web. */}
        <Pressable accessibilityRole="button" accessibilityLabel={t("edit_action")} onPress={onEdit} hitSlop={4}
          style={{ position: "absolute", right: -6, bottom: -6, width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
          <View style={[cardShadow, {
            width: 36, height: 36, borderRadius: 18, borderWidth: 2, alignItems: "center", justifyContent: "center",
            borderColor: palette.bg, backgroundColor: palette.surface,
          }]}>
            <PenIcon size={16} color={palette.main} />
          </View>
        </Pressable>
      </View>
      <View style={{ maxWidth: "100%", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.sm }}>
        <AppText accessibilityRole="header" variant="display" style={{ flexShrink: 1, textAlign: "center" }}>
          {user.displayName}
        </AppText>
        {premium ? (
          <Svg width={24} height={24} viewBox="0 0 24 24" accessibilityRole="image"
            accessibilityLabel={tPanel("premium_member")}>
            <Path fill={palette.premiumMark} fillRule="evenodd" d={PREMIUM_MASK_OUTLINE + PREMIUM_MASK_EYES} />
          </Svg>
        ) : null}
      </View>
      <View style={{ maxWidth: "100%", flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: space.sm }}>
        <AppText variant="caption" tone="secondary" numberOfLines={1} style={{ flexShrink: 1 }}>
          {user.username ? `@${user.username}` : user.email}
        </AppText>
        <AppText variant="caption" tone="secondary" accessible={false}>·</AppText>
        {user.emailVerified ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <VerifiedCheckIcon size={14} color={palette.success} />
            <AppText variant="caption" tone="success" style={{ fontWeight: "700" }}>{t("email_verified")}</AppText>
          </View>
        ) : (
          <Pressable accessibilityRole="button" accessibilityLabel={t("verify_email_cta")} disabled={sending}
            onPress={() => void resendVerification()} hitSlop={8}
            style={({ pressed }) => ({
              minHeight: 28, flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10,
              borderRadius: radii.pill, opacity: sending ? 0.6 : 1,
              backgroundColor: mixHex(palette.star, palette.surface, pressed ? 0.34 : 0.22),
            })}>
            {sending ? <ActivityIndicator size="small" color={palette.main} /> : <LetterUnreadIcon size={14} color={palette.main} />}
            <AppText variant="caption" style={{ fontWeight: "700" }}>
              {sending ? t("verification_sending") : t("verify_email_cta")}
            </AppText>
            {sending ? null : <AltArrowRightIcon size={12} color={palette.main} />}
          </Pressable>
        )}
      </View>
      {user.username ? (
        <Pressable accessibilityRole="link" hitSlop={6}
          onPress={() => router.push({ pathname: "/(app)/community-member", params: { username: user.username! } } as never)}
          style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: space.md, paddingVertical: 6 }}>
          <AppText variant="body" style={{ fontWeight: "700", color: palette.progress }}>{t("community_profile_link")}</AppText>
          <AltArrowRightIcon size={14} color={palette.progress} />
        </Pressable>
      ) : null}
    </View>
  );
}
