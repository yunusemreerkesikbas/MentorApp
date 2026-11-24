import { useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import { useMutation } from "@tanstack/react-query";
import type { MentorshipInvitationPreviewDto, MyCoachDto } from "@mentor/types";
import { art } from "../../../lib/art.js";
import { haptics } from "../../../lib/haptics.js";
import { acceptInvitation, previewInvitation } from "../../../lib/mentorship-api.js";
import { extractMentorshipError, parseInviteCodeFromInput } from "../../../lib/mentorship-view.js";
import { useTranslations } from "../../../providers/i18n-provider.js";
import { useThemeTokens } from "../../../providers/theme-provider.js";
import { PanelCard } from "../../panel/primitives.js";
import { AppText, Button, TextField } from "../../ui/index.js";
import { CoachAvatar, CoachClaimsView } from "../coach-identity-badges.js";

export function MyCoachEmptyCard({
  off,
  initialCode,
  onAccepted,
}: {
  off: boolean;
  initialCode?: string;
  onAccepted: (coach: MyCoachDto) => void;
}) {
  const t = useTranslations("students");
  const tCommon = useTranslations("common");
  const { palette, radii, space } = useThemeTokens();
  const [codeDraft, setCodeDraft] = useState(() =>
    initialCode ? parseInviteCodeFromInput(initialCode) : "",
  );
  const [preview, setPreview] = useState<MentorshipInvitationPreviewDto | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const normalizedCode = parseInviteCodeFromInput(codeDraft);

  const previewMutation = useMutation({
    mutationFn: () => previewInvitation(normalizedCode),
    onSuccess: (res) => {
      void haptics.selection();
      setErrorMsg(null);
      setPreview(res);
    },
    onError: (err) => {
      void haptics.error();
      setErrorMsg(extractMentorshipError(err, tCommon("error_body")));
    },
  });

  const acceptMutation = useMutation({
    mutationFn: () => acceptInvitation(normalizedCode),
    onSuccess: (linked) => {
      void haptics.success();
      setErrorMsg(null);
      setPreview(null);
      setCodeDraft("");
      onAccepted(linked);
    },
    onError: (err) => {
      void haptics.error();
      setErrorMsg(extractMentorshipError(err, tCommon("error_body")));
    },
  });

  if (off) {
    return (
      <PanelCard style={styles.emptyCard}>
        <Image source={art.puhuEncouraging} style={styles.puhu} resizeMode="contain" />
        <AppText variant="sectionHeading" style={styles.centered}>
          {t("my_coach_off_title")}
        </AppText>
        <AppText variant="body" tone="secondary" style={styles.centered}>
          {t("my_coach_off_body")}
        </AppText>
      </PanelCard>
    );
  }

  return (
    <View style={{ gap: space.md }}>
      <PanelCard style={styles.emptyCard}>
        <Image source={art.puhuEncouraging} style={styles.puhu} resizeMode="contain" />
        <AppText variant="sectionHeading" style={styles.centered}>
          {t("my_coach_empty_title")}
        </AppText>
        <AppText variant="body" tone="secondary" style={styles.centered}>
          {t("my_coach_empty")}
        </AppText>
      </PanelCard>

      {!preview ? (
        <PanelCard style={{ gap: space.sm }}>
          <TextField
            label={t("invite_input_label")}
            value={codeDraft}
            onChangeText={(text) => {
              setCodeDraft(text);
              setErrorMsg(null);
            }}
            placeholder={t("invite_input_placeholder")}
            autoCapitalize="characters"
            autoCorrect={false}
          />
          {errorMsg ? (
            <AppText variant="caption" tone="danger">
              {errorMsg}
            </AppText>
          ) : null}
          <Button
            label={t("preview_invite_cta")}
            disabled={!normalizedCode}
            loading={previewMutation.isPending}
            onPress={() => previewMutation.mutate()}
          />
        </PanelCard>
      ) : (
        <PanelCard style={{ gap: space.md }}>
          <View style={styles.coachRow}>
            <CoachAvatar name={preview.coachDisplayName} size={52} />
            <View style={{ flex: 1, gap: 2 }}>
              <AppText variant="caption" tone="coach">
                {t("invitation_from_label")}
              </AppText>
              <AppText variant="sectionHeading">{preview.coachDisplayName}</AppText>
              {preview.coachUsername ? (
                <AppText variant="caption" tone="secondary">
                  @{preview.coachUsername}
                </AppText>
              ) : null}
            </View>
          </View>

          {preview.coachProfile ? (
            <View style={{ gap: space.xs }}>
              <AppText variant="cardTitle">{preview.coachProfile.headline}</AppText>
              <AppText variant="body" tone="secondary">
                {preview.coachProfile.bio}
              </AppText>
              <CoachClaimsView claims={preview.coachProfile.claims} />
            </View>
          ) : (
            <AppText variant="caption" tone="secondary">
              {t("coach_profile_unknown")}
            </AppText>
          )}

          <View
            style={[
              styles.scopeBox,
              {
                backgroundColor: palette.surfaceAlt,
                borderRadius: radii.inner,
                borderColor: palette.border,
              },
            ]}
          >
            <AppText variant="cardTitle">{t("data_scope_title")}</AppText>
            {preview.dataScope.map((scopeKey) => (
              <AppText key={scopeKey} variant="caption" tone="secondary">
                • {t(`scope_${scopeKey}` as "scope_ACTIVITY")}
              </AppText>
            ))}
            <AppText variant="caption" tone="coach" style={{ marginTop: 4 }}>
              {t("privacy_trust_notice")}
            </AppText>
          </View>

          {errorMsg ? (
            <AppText variant="caption" tone="danger">
              {errorMsg}
            </AppText>
          ) : null}

          <View style={{ gap: space.sm }}>
            <Button
              label={t("accept_invite_cta")}
              loading={acceptMutation.isPending}
              onPress={() => acceptMutation.mutate()}
            />
            <Button
              label={t("cancel_preview_cta")}
              variant="secondary"
              disabled={acceptMutation.isPending}
              onPress={() => {
                setPreview(null);
                setErrorMsg(null);
              }}
            />
          </View>
        </PanelCard>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  emptyCard: {
    alignItems: "center",
    gap: 10,
  },
  puhu: {
    width: 84,
    height: 84,
  },
  centered: {
    textAlign: "center",
  },
  coachRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  scopeBox: {
    padding: 12,
    borderWidth: 1,
    gap: 6,
  },
});
