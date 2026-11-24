import { useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MENTORSHIP_DATA_SCOPE, type MentorshipClaimId } from "@mentor/types";
import { MENTORSHIP_BIO_MAX, MENTORSHIP_HEADLINE_MAX } from "@mentor/validation";
import { formatDisplayDate } from "../../lib/display-date.js";
import { haptics } from "../../lib/haptics.js";
import { tabBarClearance } from "../../lib/layout.js";
import {
  fetchCoachRegistrationState,
  fetchMentorshipOverview,
  updateCoachProfile,
} from "../../lib/mentorship-api.js";
import { extractMentorshipError } from "../../lib/mentorship-view.js";
import { useLocale, useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { PanelCard, PanelCardTitle } from "../panel/primitives.js";
import { AppText, Button, Chip, Skeleton, StateView, TextField } from "../ui/index.js";
import { CoachClaimsView } from "./coach-identity-badges.js";

export function CoachProfileView() {
  const t = useTranslations("students");
  const tCommon = useTranslations("common");
  const { locale } = useLocale();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { palette, space } = useThemeTokens();

  const regQuery = useQuery({
    queryKey: ["mentorship-registration-state"],
    queryFn: fetchCoachRegistrationState,
  });

  const overviewQuery = useQuery({
    queryKey: ["mentorship-overview"],
    queryFn: fetchMentorshipOverview,
    retry: false,
  });

  const [editing, setEditing] = useState(false);
  const [headlineDraft, setHeadlineDraft] = useState("");
  const [bioDraft, setBioDraft] = useState("");
  const [savedNotice, setSavedNotice] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const registration = regQuery.data?.registration ?? null;

  const updateMutation = useMutation({
    mutationFn: () =>
      updateCoachProfile({
        headline: headlineDraft.trim(),
        bio: bioDraft.trim(),
      }),
    onSuccess: () => {
      void haptics.success();
      setSavedNotice(true);
      setErrorMsg(null);
      setEditing(false);
      void queryClient.invalidateQueries({ queryKey: ["mentorship-registration-state"] });
    },
    onError: (err) => {
      void haptics.error();
      setErrorMsg(extractMentorshipError(err, tCommon("error_body")));
    },
  });

  const startEdit = () => {
    if (!registration) return;
    setHeadlineDraft(registration.headline);
    setBioDraft(registration.bio);
    setSavedNotice(false);
    setErrorMsg(null);
    setEditing(true);
  };

  const claimsList = registration
    ? (
        [
          registration.institution
            ? {
                claim: "INSTITUTION" as MentorshipClaimId,
                value: registration.institution,
                verified: registration.verifiedClaims.includes("INSTITUTION"),
              }
            : null,
          registration.branch
            ? {
                claim: "BRANCH" as MentorshipClaimId,
                value: registration.branch,
                verified: registration.verifiedClaims.includes("BRANCH"),
              }
            : null,
          registration.years !== null
            ? {
                claim: "YEARS" as MentorshipClaimId,
                value: String(registration.years),
                verified: registration.verifiedClaims.includes("YEARS"),
              }
            : null,
        ].filter(Boolean) as { claim: MentorshipClaimId; value: string; verified: boolean }[]
      )
    : [];

  const dataScope = overviewQuery.data?.dataScope ?? MENTORSHIP_DATA_SCOPE;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: palette.bg }}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{
        paddingTop: space.lg,
        paddingHorizontal: space.lg,
        paddingBottom: tabBarClearance(insets.bottom),
        gap: space.md,
      }}
      refreshControl={
        <RefreshControl
          refreshing={regQuery.isRefetching || overviewQuery.isRefetching}
          onRefresh={() => {
            void regQuery.refetch();
            void overviewQuery.refetch();
          }}
          tintColor={palette.coachAccent}
        />
      }
    >
      <View style={{ gap: 4 }}>
        <AppText variant="caption" tone="coach">
          {t("badge")}
        </AppText>
        <AppText variant="title">{t("profile_title")}</AppText>
        <AppText variant="body" tone="secondary">
          {t("profile_subtitle")}
        </AppText>
      </View>

      {regQuery.isLoading ? (
        <Skeleton height={200} />
      ) : regQuery.isError ? (
        <StateView
          title={tCommon("error_title")}
          body={extractMentorshipError(regQuery.error, tCommon("error_body"))}
          actionLabel={tCommon("retry")}
          onAction={() => void regQuery.refetch()}
          tone="error"
        />
      ) : registration === null ? (
        <PanelCard style={{ gap: space.sm }}>
          <PanelCardTitle>{t("profile_empty_title")}</PanelCardTitle>
          <AppText variant="body" tone="secondary">
            {t("coach_profile_missing")}
          </AppText>
          <Button
            label={t("become_coach_cta")}
            onPress={() => router.push("/(app)/coach-application" as never)}
          />
        </PanelCard>
      ) : editing ? (
        <PanelCard style={{ gap: space.sm }}>
          <TextField
            label={t("profile_headline_label")}
            value={headlineDraft}
            onChangeText={(val) => {
              setHeadlineDraft(val);
              setErrorMsg(null);
            }}
            maxLength={MENTORSHIP_HEADLINE_MAX}
          />
          <TextField
            label={t("profile_bio_label")}
            value={bioDraft}
            onChangeText={(val) => {
              setBioDraft(val);
              setErrorMsg(null);
            }}
            maxLength={MENTORSHIP_BIO_MAX}
            multiline
            style={{ minHeight: 110, paddingTop: 10, textAlignVertical: "top" }}
          />
          <AppText variant="caption" tone="secondary">
            {t("profile_edit_claims_locked")}
          </AppText>
          {errorMsg ? (
            <AppText variant="caption" tone="danger">
              {errorMsg}
            </AppText>
          ) : null}
          <View style={styles.editActions}>
            <Button
              label={t("cancel_preview_cta")}
              variant="secondary"
              disabled={updateMutation.isPending}
              onPress={() => setEditing(false)}
              style={styles.editActionBtn}
            />
            <Button
              label={t("profile_save_cta")}
              disabled={!headlineDraft.trim() || !bioDraft.trim()}
              loading={updateMutation.isPending}
              onPress={() => updateMutation.mutate()}
              style={styles.editActionBtn}
            />
          </View>
        </PanelCard>
      ) : (
        <PanelCard style={{ gap: space.sm }}>
          <View style={styles.statusRow}>
            <View style={{ flex: 1 }}>
              <AppText variant="sectionHeading">{registration.headline}</AppText>
            </View>
            <Chip
              label={t(`coach_status_${registration.status}` as "coach_status_ACTIVE")}
              tone={registration.status === "ACTIVE" ? "coach" : "warning"}
            />
          </View>

          <AppText variant="body" tone="secondary">
            {t(`coach_status_${registration.status}_body` as "coach_status_ACTIVE_body")}
          </AppText>

          {registration.status === "ACTIVE" ? (
            <AppText variant="body">{registration.bio}</AppText>
          ) : null}

          {registration.status === "ACTIVE" && regQuery.data && !regQuery.data.emailVerified ? (
            <AppText variant="caption" tone="warning">
              {t("coach_email_unverified")}
            </AppText>
          ) : null}

          {registration.reviewNote !== null ? (
            <AppText variant="caption" tone="secondary">
              {registration.reviewNote}
              {registration.reviewedAt
                ? ` · ${formatDisplayDate(registration.reviewedAt, locale)}`
                : ""}
            </AppText>
          ) : null}

          <CoachClaimsView claims={claimsList} />

          {savedNotice ? (
            <AppText variant="caption" tone="success">
              {t("profile_saved")}
            </AppText>
          ) : null}

          {registration.status === "ACTIVE" ? (
            <Button
              label={t("profile_edit_cta")}
              variant="secondary"
              onPress={startEdit}
            />
          ) : null}
        </PanelCard>
      )}

      <PanelCard style={{ gap: space.sm }}>
        <PanelCardTitle>{t("data_scope_title")}</PanelCardTitle>
        {dataScope.map((scopeKey) => (
          <AppText key={scopeKey} variant="body" tone="secondary">
            • {t(`coach_scope_${scopeKey}` as "coach_scope_ACTIVITY")}
          </AppText>
        ))}
        <AppText variant="caption" tone="coach">
          {t("coach_scope_never_body")}
        </AppText>
      </PanelCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  statusRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  editActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 4,
  },
  editActionBtn: {
    flexGrow: 1,
    minWidth: 190,
  },
});
