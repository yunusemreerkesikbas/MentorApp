import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { InfoCircleIcon } from "@solar-icons/react-native/linear/info-circle";
import type { MyCoachDto } from "@mentor/types";
import { formatDisplayDate } from "../../../lib/display-date.js";
import { useLocale, useTranslations } from "../../../providers/i18n-provider.js";
import { useThemeTokens } from "../../../providers/theme-provider.js";
import { PanelCard } from "../../panel/primitives.js";
import { AppText, Button } from "../../ui/index.js";
import { CoachAvatar, CoachClaimsView } from "../coach-identity-badges.js";

export function MyCoachHeroCard({
  coach,
  welcome,
}: {
  coach: MyCoachDto;
  welcome: boolean;
}) {
  const t = useTranslations("students");
  const { locale } = useLocale();
  const router = useRouter();
  const { palette, radii, space } = useThemeTokens();
  const profile = coach.coachProfile;
  const metaParts = [
    coach.acceptedAt
      ? t("my_coach_since", { date: formatDisplayDate(coach.acceptedAt, locale) })
      : null,
    coach.coachUsername ? `@${coach.coachUsername}` : null,
  ].filter(Boolean);

  return (
    <PanelCard style={{ gap: space.md }}>
      {welcome ? (
        <View
          style={[
            styles.banner,
            { backgroundColor: palette.coachAccentSoft, borderRadius: radii.inner },
          ]}
        >
          <AppText variant="caption" tone="coach">
            {t("my_coach_welcome", { name: coach.coachDisplayName })}
          </AppText>
        </View>
      ) : null}

      <View style={styles.headerRow}>
        <CoachAvatar name={coach.coachDisplayName} size={56} />
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="caption" tone="coach">
            {t("my_coach_eyebrow")}
          </AppText>
          <AppText variant="title">{coach.coachDisplayName}</AppText>
          {metaParts.length > 0 ? (
            <AppText variant="caption" tone="secondary">
              {metaParts.join(" · ")}
            </AppText>
          ) : null}
        </View>
      </View>

      {coach.coachStatus != null && coach.coachStatus !== "ACTIVE" ? (
        <View
          style={[
            styles.banner,
            { backgroundColor: palette.playSelected, borderRadius: radii.inner },
          ]}
        >
          <InfoCircleIcon size={18} color={palette.playSelectedInk} />
          <AppText variant="caption" style={{ flex: 1, color: palette.main }}>
            {t("my_coach_suspended")}
          </AppText>
        </View>
      ) : null}

      {coach.seatWaiting ? (
        <View
          style={[
            styles.banner,
            { backgroundColor: palette.playSelected, borderRadius: radii.inner },
          ]}
        >
          <InfoCircleIcon size={18} color={palette.playSelectedInk} />
          <AppText variant="caption" style={{ flex: 1, color: palette.main }}>
            {t("my_coach_seat_waiting")}
          </AppText>
        </View>
      ) : null}

      {coach.sponsoredPremiumPending ? (
        <View
          style={[
            styles.pendingBox,
            { backgroundColor: palette.warningBg, borderRadius: radii.inner },
          ]}
        >
          <AppText variant="caption" tone="warning">
            {t("sponsored_premium_pending")}
          </AppText>
          <Button
            label={t("open_phone_settings_cta")}
            variant="secondary"
            onPress={() => router.push("/(app)/(tabs)/settings" as never)}
          />
        </View>
      ) : null}

      {profile === null ? (
        <AppText variant="caption" tone="secondary">
          {t("coach_profile_unknown")}
        </AppText>
      ) : (
        <View style={{ gap: space.xs }}>
          <AppText variant="cardTitle">{profile.headline}</AppText>
          <AppText variant="body" tone="secondary">
            {profile.bio}
          </AppText>
          <CoachClaimsView claims={profile.claims} />
        </View>
      )}

      {coach.coachNote ? (
        <View style={{ gap: 6 }}>
          <AppText variant="caption" tone="coach">
            {t("coach_note_label")}
          </AppText>
          <View
            style={[
              styles.noteBox,
              {
                backgroundColor: palette.coachAccentSoft,
                borderColor: palette.coachAccent,
                borderRadius: radii.inner,
              },
            ]}
          >
            <AppText variant="body">{coach.coachNote.body}</AppText>
            <AppText variant="micro" tone="secondary">
              {t("note_updated_on", {
                date: formatDisplayDate(coach.coachNote.updatedAt, locale),
              })}
            </AppText>
          </View>
        </View>
      ) : null}
    </PanelCard>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  banner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 12,
  },
  pendingBox: {
    padding: 12,
    gap: 8,
  },
  noteBox: {
    padding: 12,
    borderWidth: 1,
    gap: 4,
  },
});
