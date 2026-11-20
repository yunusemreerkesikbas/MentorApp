import { Image } from "expo-image";
import { View } from "react-native";
import { UserIcon } from "@solar-icons/react-native/bold/user";
import { VerifiedCheckIcon } from "@solar-icons/react-native/bold/verified-check";
import Svg, { Path } from "react-native-svg";
import type { AuthUser } from "@mentor/types";
import { PREMIUM_MASK_EYES, PREMIUM_MASK_OUTLINE, useIsPremium } from "../../lib/premium.js";
import { useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { AppText } from "../ui/index.js";

const AVATAR_SIZE = 120;

export function SettingsIdentity({ user }: { user: AuthUser }) {
  const t = useTranslations("settings");
  const tPanel = useTranslations("panel");
  const premium = useIsPremium();
  const { palette, radii, space } = useThemeTokens();

  return (
    <View style={{ alignItems: "center", gap: space.sm, paddingVertical: space.sm }}>
      <View style={{
        width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: radii.pill, overflow: "hidden",
        alignItems: "center", justifyContent: "center", borderWidth: 1,
        backgroundColor: palette.surfaceAlt, borderColor: palette.border,
      }}>
        {user.avatarUrl ? (
          <Image source={{ uri: user.avatarUrl }} contentFit="cover" accessible={false}
            style={{ width: "100%", height: "100%" }} />
        ) : <UserIcon size={56} color={palette.muted} />}
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
      <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: space.sm }}>
        {user.username ? <AppText variant="caption" tone="secondary">@{user.username}</AppText> : null}
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.xs }}>
          {user.emailVerified ? <VerifiedCheckIcon size={15} color={palette.success} /> : null}
          <AppText variant="caption" tone={user.emailVerified ? "success" : "secondary"}>
            {t(user.emailVerified ? "email_verified" : "email_unverified")}
          </AppText>
        </View>
      </View>
    </View>
  );
}
