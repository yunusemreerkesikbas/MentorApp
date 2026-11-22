import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { ApiClientError } from "@mentor/api-client";
import { fetchMyCoach } from "../../lib/mentorship-api.js";
import { useAppAvailability } from "../../providers/availability-provider.js";
import { useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { AppText, Button, Card, Chip } from "../ui/index.js";

/**
 * Settings summary entry for Student <-> Human Coach (`İnsan Koçum`).
 * Keeps Settings fast while linking into dedicated `/(app)/my-coach` and `/(app)/coach-application`.
 */
export function MyCoachCard() {
  const t = useTranslations("students");
  const router = useRouter();
  const { space } = useThemeTokens();
  const { availability } = useAppAvailability();

  const myCoachQuery = useQuery({
    queryKey: ["my-coach"],
    queryFn: async () => {
      try {
        return await fetchMyCoach();
      } catch (err) {
        if (err instanceof ApiClientError && err.body.code === "MENTORSHIP_DISABLED") {
          return null;
        }
        throw err;
      }
    },
    retry: false,
  });

  if (!availability.humanCoaching && !myCoachQuery.data) {
    return null;
  }

  const coach = myCoachQuery.data ?? null;

  return (
    <Card style={{ gap: space.sm }}>
      <View style={styles.headerRow}>
        <AppText variant="sectionHeading">{t("my_coach_title")}</AppText>
        {coach ? <Chip label={coach.coachDisplayName} tone="coach" /> : null}
      </View>

      {coach ? (
        <AppText variant="body" tone="secondary">
          {coach.coachProfile?.headline ?? t("my_coach_settings_linked_hint")}
        </AppText>
      ) : (
        <AppText variant="body" tone="secondary">
          {t("my_coach_empty")}
        </AppText>
      )}

      <Button
        label={coach ? t("open_my_coach_cta") : t("open_my_coach_connect_cta")}
        variant="secondary"
        onPress={() => router.push("/(app)/my-coach" as never)}
      />

      {!coach && availability.coachRegistration ? (
        <Button
          label={t("become_coach_cta")}
          variant="secondary"
          onPress={() => router.push("/(app)/coach-application" as never)}
        />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    flexWrap: "wrap",
  },
});
