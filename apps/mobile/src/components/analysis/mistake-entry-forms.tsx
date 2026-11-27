import { useState } from "react";
import { View } from "react-native";
import { Image } from "expo-image";
import { useMutation } from "@tanstack/react-query";
import { ApiClientError } from "@mentor/api-client";
import { NOTEBOOK_ERROR_TYPES, type ExamSubjectDto, type NotebookEntryDto, type NotebookErrorType } from "@mentor/types";
import { deleteNotebookEntry, updateNotebookEntry } from "../../lib/analysis-api.js";
import { haptics } from "../../lib/haptics.js";
import { uploadNotebookPhoto } from "../../lib/notebook-api.js";
import { useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { AppText, Button, Chip, ConfirmDialog } from "../ui/index.js";
import { AnalysisLink } from "./analysis-link.js";

export type StagedPhoto = { key: string; uri: string };

const apiMessage = (err: unknown) => err instanceof ApiClientError ? err.body.message : null;

/**
 * One optional photo on a mistake entry (the question, or its solution). It uploads as soon as it is
 * picked, like the web, so the entry itself only ever carries the stored key. The photo limit and the
 * Premium gate come back as the API's own localized message.
 */
export function EntryPhotoField({ label, photo, onChange, disabled, onUploadingChange }: {
  label: string;
  photo: StagedPhoto | null;
  onChange: (photo: StagedPhoto | null) => void;
  disabled?: boolean;
  /** Lets the form hold Kaydet (and the other photo field) while this upload runs. */
  onUploadingChange?: (uploading: boolean) => void;
}) {
  const t = useTranslations("analysis");
  const { space } = useThemeTokens();
  const upload = useMutation({
    mutationFn: (source: "camera" | "gallery") => uploadNotebookPhoto(source),
    onSuccess: (image) => { if (image) onChange({ key: image.key, uri: image.uri }); },
    onSettled: () => onUploadingChange?.(false),
  });
  // The form is told in the same tap, before the picker opens, so Kaydet can never slip in between.
  const pick = (source: "camera" | "gallery") => {
    if (disabled || upload.isPending) return;
    onUploadingChange?.(true);
    upload.mutate(source);
  };
  return (
    <View style={{ gap: space.sm }}>
      <AppText variant="caption" tone="secondary">{label}</AppText>
      {photo ? (
        <>
          <Image source={{ uri: photo.uri }} contentFit="contain" style={{ height: 160 }} accessibilityLabel={label} />
          <AnalysisLink label={t("entry_photo_remove")} onPress={() => onChange(null)} />
        </>
      ) : (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
          <Chip label={t("entry_photo_camera")} onPress={() => pick("camera")} />
          <Chip label={t("entry_photo_gallery")} onPress={() => pick("gallery")} />
        </View>
      )}
      {upload.isPending ? <AppText variant="caption" tone="muted">…</AppText> : null}
      {upload.isError ? <AppText tone="danger">{apiMessage(upload.error) ?? t("entry_photo_error")}</AppText> : null}
    </View>
  );
}

/**
 * Correct a filed card, take it in or out of the review deck, or delete it — the web's
 * `NotebookEntryEditDialog`. Kept off the review deck on purpose: a card never vanishes mid-review.
 */
export function NotebookEntryEditForm({ entry, subjects, onSaved, onDeleted, onBack }: {
  entry: NotebookEntryDto;
  subjects: ExamSubjectDto[];
  onSaved: () => Promise<void>;
  onDeleted: () => Promise<void>;
  onBack: () => void;
}) {
  const t = useTranslations("analysis");
  const tReview = useTranslations("analysisReview");
  const { space } = useThemeTokens();
  const [subject, setSubject] = useState(entry.subjectRef);
  const [reason, setReason] = useState<NotebookErrorType>(entry.errorType);
  const [confirming, setConfirming] = useState(false);
  const save = useMutation({
    // A topic belongs to its subject: keep it only while the subject stays the same.
    mutationFn: () => updateNotebookEntry(entry.id, {
      errorType: reason, subjectRef: subject, topicRef: subject === entry.subjectRef ? entry.topicRef : null,
    }),
    onSuccess: async () => { haptics.success(); await onSaved(); },
  });
  const rotation = useMutation({
    mutationFn: (inRotation: boolean) => updateNotebookEntry(entry.id, { status: inRotation ? "ACTIVE" : "ARCHIVED" }),
    onSuccess: async () => { haptics.success(); await onSaved(); },
  });
  const remove = useMutation({
    mutationFn: () => deleteNotebookEntry(entry.id),
    onSuccess: async () => { haptics.success(); await onDeleted(); },
  });
  const busy = save.isPending || rotation.isPending || remove.isPending;
  const row = { flexDirection: "row", flexWrap: "wrap", gap: space.sm } as const;

  return (
    <View style={{ gap: space.md }}>
      <AppText variant="caption" tone="secondary">{t("mistake_error_type_label")}</AppText>
      <View style={row}>
        {NOTEBOOK_ERROR_TYPES.map((key) => (
          <Chip label={t(`error_${key}`)} key={key} selected={reason === key} onPress={() => setReason(key)} />
        ))}
      </View>
      {subjects.length ? (
        <>
          <AppText variant="caption" tone="secondary">{t("mistake_subject_label")}</AppText>
          <View style={row}>
            {subjects.map((item) => (
              <Chip label={item.name} key={item.slug} selected={subject === item.slug} onPress={() => setSubject(item.slug)} />
            ))}
          </View>
        </>
      ) : null}
      {save.isError ? <AppText tone="danger">{apiMessage(save.error) ?? t("entry_save_error")}</AppText> : null}
      <Button label={t("entry_edit_save")} loading={save.isPending} disabled={busy} onPress={() => save.mutate()} />

      <AppText variant="cardTitle">{t("entry_rotation_title")}</AppText>
      <AppText tone="secondary">
        {entry.status === "ACTIVE" ? t("entry_rotation_in") : entry.status === "HEALED" ? t("entry_rotation_healed") : t("entry_rotation_out")}
      </AppText>
      <Button variant="secondary" loading={rotation.isPending} disabled={busy}
        label={entry.status === "ACTIVE" ? t("entry_rotation_remove") : entry.status === "HEALED" ? t("entry_rotation_restudy") : t("entry_rotation_add")}
        onPress={() => rotation.mutate(entry.status !== "ACTIVE")} />
      {rotation.isError ? <AppText tone="danger">{apiMessage(rotation.error) ?? t("entry_save_error")}</AppText> : null}

      <Button variant="danger" label={t("entry_delete")} loading={remove.isPending} disabled={busy} onPress={() => setConfirming(true)} />
      {remove.isError ? <AppText tone="danger">{apiMessage(remove.error) ?? t("entry_delete_error")}</AppText> : null}
      <AnalysisLink label={tReview("back_index")} onPress={onBack} />
      <ConfirmDialog visible={confirming} destructive title={t("entry_delete_title")} message={t("entry_delete_body")}
        confirmLabel={t("entry_delete")} cancelLabel={t("entry_cancel")}
        onCancel={() => setConfirming(false)} onConfirm={() => { setConfirming(false); remove.mutate(); }} />
    </View>
  );
}
