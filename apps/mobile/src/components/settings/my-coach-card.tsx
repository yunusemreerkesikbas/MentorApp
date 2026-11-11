import { useState } from "react";
import { View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { MentorshipInvitationPreviewDto } from "@mentor/types";
import {
  acceptInvitation,
  endMyCoachLink,
  fetchMyCoach,
  previewInvitation,
  setMyNote,
} from "../../lib/mentorship-api.js";
import { haptics } from "../../lib/haptics.js";
import { useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { AppText, Button, Card, TextField } from "../ui/index.js";

export function MyCoachCard() {
  const t = useTranslations("students");
  const { palette, radii, space } = useThemeTokens();
  const queryClient = useQueryClient();

  const myCoachQuery = useQuery({
    queryKey: ["my-coach"],
    queryFn: fetchMyCoach,
  });

  const [codeDraft, setCodeDraft] = useState("");
  const [preview, setPreview] =
    useState<MentorshipInvitationPreviewDto | null>(null);
  const [noteDraft, setNoteDraft] = useState<string | null>(null);

  const previewMutation = useMutation({
    mutationFn: () => previewInvitation(codeDraft),
    onSuccess: (res) => {
      void haptics.selection();
      setPreview(res);
    },
  });

  const acceptMutation = useMutation({
    mutationFn: () => acceptInvitation(codeDraft),
    onSuccess: () => {
      void haptics.success();
      setCodeDraft("");
      setPreview(null);
      void queryClient.invalidateQueries({ queryKey: ["my-coach"] });
    },
  });

  const saveNoteMutation = useMutation({
    mutationFn: () =>
      setMyNote(
        (noteDraft ?? myCoachQuery.data?.studentNote?.body ?? "").trim() ||
          null,
      ),
    onSuccess: () => {
      void haptics.success();
      void queryClient.invalidateQueries({ queryKey: ["my-coach"] });
    },
  });

  const endLinkMutation = useMutation({
    mutationFn: endMyCoachLink,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["my-coach"] });
    },
  });

  const coach = myCoachQuery.data;

  if (coach) {
    const effectiveNote = noteDraft ?? coach.studentNote?.body ?? "";
    return (
      <Card style={{ gap: space.sm }}>
        <AppText variant="sectionHeading">{t("my_coach_title")}</AppText>
        <AppText variant="cardTitle" tone="coach">
          {coach.coachDisplayName}
          {coach.coachUsername ? ` (@${coach.coachUsername})` : ""}
        </AppText>
        {coach.coachProfile ? (
          <AppText variant="caption" tone="secondary">
            {coach.coachProfile.headline}
          </AppText>
        ) : null}

        {coach.coachNote ? (
          <View
            style={{
              padding: space.sm,
              borderRadius: radii.card,
              borderWidth: 1,
              backgroundColor: palette.surfaceAlt,
              borderColor: palette.border,
              gap: 4,
            }}
          >
            <AppText variant="caption" tone="coach">
              {t("coach_note_label")}
            </AppText>
            <AppText variant="body">{coach.coachNote.body}</AppText>
          </View>
        ) : null}

        <TextField
          label={t("my_note_label")}
          value={effectiveNote}
          onChangeText={setNoteDraft}
          placeholder={t("my_note_placeholder")}
          multiline
        />
        <Button
          label={t("save_note_cta")}
          variant="secondary"
          loading={saveNoteMutation.isPending}
          onPress={() => saveNoteMutation.mutate()}
        />

        <Button
          label={t("end_my_coach_cta")}
          variant="danger"
          loading={endLinkMutation.isPending}
          onPress={() => endLinkMutation.mutate()}
        />
      </Card>
    );
  }

  return (
    <Card style={{ gap: space.sm }}>
      <AppText variant="sectionHeading">{t("my_coach_title")}</AppText>
      <AppText variant="body" tone="secondary">
        {t("my_coach_empty")}
      </AppText>

      {!preview ? (
        <>
          <TextField
            label={t("invite_input_label")}
            value={codeDraft}
            onChangeText={setCodeDraft}
            placeholder={t("invite_input_placeholder")}
            autoCapitalize="characters"
          />
          <Button
            label={t("preview_invite_cta")}
            variant="secondary"
            disabled={!codeDraft.trim()}
            loading={previewMutation.isPending}
            onPress={() => previewMutation.mutate()}
          />
        </>
      ) : (
        <View
          style={{
            padding: space.sm,
            borderRadius: radii.card,
            borderWidth: 1,
            backgroundColor: palette.surfaceAlt,
            borderColor: palette.coachAccent,
            gap: space.xs,
          }}
        >
          <AppText variant="cardTitle" tone="coach">
            {preview.coachDisplayName}
          </AppText>
          {preview.coachProfile ? (
            <AppText variant="caption" tone="secondary">
              {preview.coachProfile.headline}
            </AppText>
          ) : null}
          <AppText variant="caption" tone="main">
            {t("data_scope_title")}
          </AppText>
          {preview.dataScope.map((scopeKey) => (
            <AppText key={scopeKey} variant="caption" tone="secondary">
              • {t(`scope_${scopeKey}` as "scope_ACTIVITY")}
            </AppText>
          ))}
          <AppText variant="caption" tone="coach">
            {t("privacy_trust_notice")}
          </AppText>
          <Button
            label={t("accept_invite_cta")}
            loading={acceptMutation.isPending}
            onPress={() => acceptMutation.mutate()}
          />
          <Button
            label={t("cancel_preview_cta")}
            variant="secondary"
            onPress={() => setPreview(null)}
          />
        </View>
      )}
    </Card>
  );
}
