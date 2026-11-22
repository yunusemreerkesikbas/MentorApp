import { useState } from "react";
import { View } from "react-native";
import { useMutation } from "@tanstack/react-query";
import { MENTORSHIP_COACH_NOTE_MAX } from "@mentor/validation";
import type { MentorshipCoachNoteDto } from "@mentor/types";
import { haptics } from "../../../lib/haptics.js";
import { setMyNote } from "../../../lib/mentorship-api.js";
import { extractMentorshipError } from "../../../lib/mentorship-view.js";
import { useTranslations } from "../../../providers/i18n-provider.js";
import { useThemeTokens } from "../../../providers/theme-provider.js";
import { useToast } from "../../../providers/toast-provider.js";
import { PanelCard, PanelCardTitle } from "../../panel/primitives.js";
import { AppText, Button, TextField } from "../../ui/index.js";

export function MyCoachNoteCard({
  note,
  onSaved,
}: {
  note: MentorshipCoachNoteDto | null;
  onSaved: (next: MentorshipCoachNoteDto | null) => void;
}) {
  const t = useTranslations("students");
  const tCommon = useTranslations("common");
  const toast = useToast();
  const { space } = useThemeTokens();
  const [draft, setDraft] = useState(note?.body ?? "");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const trimmed = draft.trim();
  const nextBody = trimmed.length > 0 ? trimmed : null;
  const unchanged = nextBody === (note?.body ?? null);

  const saveMutation = useMutation({
    mutationFn: () => setMyNote(nextBody),
    onSuccess: () => {
      void haptics.success();
      setErrorMsg(null);
      onSaved(
        nextBody === null
          ? null
          : { body: nextBody, updatedAt: new Date().toISOString() },
      );
      toast.show(nextBody === null ? t("note_cleared") : t("note_saved"));
    },
    onError: (err) => {
      void haptics.error();
      setErrorMsg(extractMentorshipError(err, tCommon("error_body")));
    },
  });

  return (
    <PanelCard style={{ gap: space.sm }}>
      <PanelCardTitle>{t("my_note_label")}</PanelCardTitle>
      <TextField
        label={t("my_note_hint", { count: draft.length, max: MENTORSHIP_COACH_NOTE_MAX })}
        value={draft}
        onChangeText={(text) => {
          setDraft(text);
          setErrorMsg(null);
        }}
        placeholder={t("my_note_placeholder")}
        maxLength={MENTORSHIP_COACH_NOTE_MAX}
        multiline
        style={{ minHeight: 84, paddingTop: 10, textAlignVertical: "top" }}
      />
      {errorMsg ? (
        <AppText variant="caption" tone="danger">
          {errorMsg}
        </AppText>
      ) : null}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
        <Button
          label={t("save_note_cta")}
          variant="secondary"
          disabled={unchanged}
          loading={saveMutation.isPending}
          onPress={() => saveMutation.mutate()}
          style={{ flex: 1 }}
        />
      </View>
    </PanelCard>
  );
}
