import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  MENTORSHIP_BIO_MAX,
  MENTORSHIP_HEADLINE_MAX,
  registerCoachSchema,
} from "@mentor/validation";
import { MentorshipStackBar } from "../../components/mentorship/coach-identity-badges.js";
import { PanelCard, PanelCardTitle } from "../../components/panel/primitives.js";
import { AppText, Button, Skeleton, TextField } from "../../components/ui/index.js";
import { haptics } from "../../lib/haptics.js";
import { fetchCoachRegistrationState, registerCoach } from "../../lib/mentorship-api.js";
import { extractMentorshipError } from "../../lib/mentorship-view.js";
import { useAuth } from "../../providers/auth-provider.js";
import { useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";

export default function CoachApplicationScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { refreshSession } = useAuth();
  const { palette, space } = useThemeTokens();
  const t = useTranslations("students");
  const tCommon = useTranslations("common");

  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [institution, setInstitution] = useState("");
  const [branch, setBranch] = useState("");
  const [years, setYears] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const stateQuery = useQuery({
    queryKey: ["mentorship-registration-state"],
    queryFn: fetchCoachRegistrationState,
  });

  const trimNull = (value: string) => (value.trim() ? value.trim() : null);

  const submitMutation = useMutation({
    mutationFn: async () => {
      const parsedYears =
        years.trim() === "" ? null : Number.parseInt(years.trim(), 10);
      const parsed = registerCoachSchema.safeParse({
        headline: headline.trim(),
        bio: bio.trim(),
        institution: trimNull(institution),
        branch: trimNull(branch),
        years: Number.isNaN(parsedYears) ? -1 : parsedYears,
        note: null,
      });
      if (!parsed.success) {
        throw new Error(t("application_validation_error"));
      }
      await registerCoach(parsed.data);
      await refreshSession();
      await queryClient.invalidateQueries({ queryKey: ["mentorship-registration-state"] });
    },
    onSuccess: () => {
      void haptics.success();
      router.replace("/(app)/(tabs)/students" as never);
    },
    onError: (err) => {
      void haptics.error();
      setErrorMsg(extractMentorshipError(err, tCommon("error_body")));
    },
  });

  const state = stateQuery.data;

  return (
    <View style={[styles.screen, { backgroundColor: palette.bg }]}>
      <MentorshipStackBar title={t("become_coach_title")} onBack={() => router.back()} />
      <ScrollView
        style={styles.scroll}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          padding: space.lg,
          paddingBottom: insets.bottom + space.xl,
          gap: space.md,
        }}
      >
        {stateQuery.isLoading ? (
          <Skeleton height={240} />
        ) : state && !state.registrationOpen ? (
          <PanelCard style={{ gap: space.xs }}>
            <PanelCardTitle>{t("coach_registration_closed_title")}</PanelCardTitle>
            <AppText variant="body" tone="secondary">
              {t("coach_registration_closed_body")}
            </AppText>
          </PanelCard>
        ) : state?.hasCoach ? (
          <PanelCard style={{ gap: space.sm }}>
            <PanelCardTitle>{t("coach_registration_blocked_student_title")}</PanelCardTitle>
            <AppText variant="body" tone="secondary">
              {t("coach_registration_blocked_student_body")}
            </AppText>
            <Button
              label={t("open_my_coach_cta")}
              variant="secondary"
              onPress={() => router.replace("/(app)/my-coach" as never)}
            />
          </PanelCard>
        ) : (
          <PanelCard style={{ gap: space.md }}>
            <AppText variant="body" tone="secondary">
              {t("become_coach_subtitle")}
            </AppText>
            <TextField
              label={t("profile_headline_label")}
              placeholder={t("application_headline_placeholder")}
              value={headline}
              onChangeText={(text) => {
                setHeadline(text);
                setErrorMsg(null);
              }}
              maxLength={MENTORSHIP_HEADLINE_MAX}
            />
            <TextField
              label={t("profile_bio_label")}
              placeholder={t("application_bio_placeholder")}
              value={bio}
              onChangeText={(text) => {
                setBio(text);
                setErrorMsg(null);
              }}
              maxLength={MENTORSHIP_BIO_MAX}
              multiline
              style={{ minHeight: 110, paddingTop: 10, textAlignVertical: "top" }}
            />
            <AppText variant="caption" tone="secondary">
              {t("application_claims_hint")}
            </AppText>
            <TextField
              label={t("application_institution_label")}
              value={institution}
              onChangeText={setInstitution}
              maxLength={160}
            />
            <TextField
              label={t("application_branch_label")}
              value={branch}
              onChangeText={setBranch}
              maxLength={80}
            />
            <TextField
              label={t("application_years_label")}
              value={years}
              onChangeText={(v) => setYears(v.replace(/\D/g, "").slice(0, 2))}
              keyboardType="number-pad"
            />
            {errorMsg ? (
              <AppText variant="caption" tone="danger">
                {errorMsg}
              </AppText>
            ) : null}
            <Button
              label={t("become_coach_submit")}
              disabled={!headline.trim() || !bio.trim()}
              loading={submitMutation.isPending}
              onPress={() => submitMutation.mutate()}
            />
          </PanelCard>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { flex: 1 },
});
