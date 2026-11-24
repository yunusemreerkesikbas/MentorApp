import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AltArrowLeftIcon } from "@solar-icons/react-native/linear/alt-arrow-left";
import { VerifiedCheckIcon } from "@solar-icons/react-native/bold/verified-check";
import type { MentorshipCoachProfileDto } from "@mentor/types";
import { useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { AppText } from "../ui/index.js";

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "K";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toLocaleUpperCase("tr-TR");
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toLocaleUpperCase("tr-TR");
}

export function CoachAvatar({
  name,
  size = 48,
}: {
  name: string;
  size?: number;
}) {
  const { palette } = useThemeTokens();
  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: palette.coachAccent,
          borderColor: palette.coachAccentSoft,
        },
      ]}
    >
      <AppText
        style={{
          color: palette.bg,
          fontSize: Math.max(13, Math.round(size * 0.36)),
          fontWeight: "900",
        }}
      >
        {initialsOf(name)}
      </AppText>
    </View>
  );
}

/**
 * Renders admin-verified claims and coach-declared claims in two visibly separate groups
 * (`MentorshipCoachProfileDto` contract: never present an unverified claim as endorsed).
 */
export function CoachClaimsView({
  claims,
}: {
  claims: MentorshipCoachProfileDto["claims"];
}) {
  const t = useTranslations("students");
  const { palette, radii, space } = useThemeTokens();
  const verified = claims.filter((item) => item.verified);
  const declared = claims.filter((item) => !item.verified);
  if (claims.length === 0) return null;

  return (
    <View style={{ gap: space.sm }}>
      {verified.length > 0 ? (
        <View style={{ gap: 6 }}>
          <AppText variant="caption" tone="secondary">
            {t("verified_claims_label")}
          </AppText>
          <View style={styles.claimList}>
            {verified.map(({ claim, value }) => (
              <View
                key={`v-${claim}`}
                style={[
                  styles.claimPill,
                  {
                    backgroundColor: palette.coachAccentSoft,
                    borderColor: palette.coachAccent,
                    borderRadius: radii.pill,
                  },
                ]}
              >
                <VerifiedCheckIcon size={14} color={palette.coachAccent} />
                <AppText variant="caption" tone="coach">
                  {t(`claim_${claim}`, { value })}
                </AppText>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {declared.length > 0 ? (
        <View style={{ gap: 6 }}>
          <AppText variant="caption" tone="secondary">
            {t("declared_claims_label")}
          </AppText>
          <View style={styles.claimList}>
            {declared.map(({ claim, value }) => (
              <View
                key={`d-${claim}`}
                style={[
                  styles.claimPill,
                  styles.declaredPill,
                  {
                    backgroundColor: palette.surfaceAlt,
                    borderColor: palette.secondary,
                    borderRadius: radii.pill,
                  },
                ]}
              >
                <AppText variant="caption" tone="secondary">
                  {t(`claim_${claim}`, { value })}
                </AppText>
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

export function MentorshipStackBar({
  title,
  onBack,
  right,
}: {
  title: string;
  onBack: () => void;
  right?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const t = useTranslations("students");
  const { palette } = useThemeTokens();

  return (
    <View
      style={[
        styles.topChrome,
        {
          paddingTop: insets.top,
          backgroundColor: palette.surface,
          borderBottomColor: palette.playLine,
        },
      ]}
    >
      <View style={styles.navBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("back_cta")}
          onPress={onBack}
          style={styles.iconBtn}
        >
          <AltArrowLeftIcon size={22} color={palette.main} strokeWidth={1.75} />
        </Pressable>
        <AppText accessibilityRole="header" style={styles.navTitle} numberOfLines={1}>
          {title}
        </AppText>
        <View style={styles.rightWrap}>{right}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
  },
  claimList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  claimPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  declaredPill: {
    borderStyle: "dashed",
  },
  topChrome: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  navBar: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    gap: 8,
  },
  iconBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  navTitle: {
    flex: 1,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "800",
  },
  rightWrap: {
    minWidth: 44,
    alignItems: "flex-end",
    justifyContent: "center",
  },
});
