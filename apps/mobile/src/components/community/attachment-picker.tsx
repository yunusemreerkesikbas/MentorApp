import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { FORUM_MAX_ATTACHMENTS } from "@mentor/types";
import type { AttachmentInput } from "@mentor/validation";
import { CloseCircleIcon } from "@solar-icons/react-native/bold/close-circle";
import { PaperclipIcon } from "@solar-icons/react-native/linear/paperclip";
import { checkForumPhoto } from "../../lib/community-view.js";
import { devicePhotoSize, pickDevicePhoto, type DevicePhoto } from "../../lib/device-photo.js";
import { uploadForumPhoto } from "../../lib/forum-attachments.js";
import { haptics } from "../../lib/haptics.js";
import { useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { ActionSheet } from "../panel/primitives.js";
import { AppText } from "../ui/index.js";

/**
 * The web's `useForumImagePicker`, images only (owner, 2026-11-26): photos are checked when picked
 * and uploaded on send, so a failed upload keeps both the text and the picked photos.
 */
export function useForumAttachments() {
  const t = useTranslations("community");
  const [items, setItems] = useState<DevicePhoto[]>([]);
  const [error, setError] = useState<string | null>(null);

  const pick = async (source: "camera" | "gallery") => {
    setError(null);
    if (items.length >= FORUM_MAX_ATTACHMENTS) return setError(t("attach_too_many", { max: FORUM_MAX_ATTACHMENTS }));
    try {
      const photo = await pickDevicePhoto(source);
      if (!photo) return;
      const problem = checkForumPhoto(photo.mimeType, devicePhotoSize(photo), items.length);
      if (problem) return setError(t(`attach_${problem}`, { max: FORUM_MAX_ATTACHMENTS }));
      setItems((prev) => [...prev, photo]);
    } catch (err) {
      setError(t(err instanceof Error && err.message === "format" ? "attach_unsupported" : "attach_failed"));
    }
  };

  return {
    items,
    error,
    setError,
    pick,
    remove: (index: number) => setItems((prev) => prev.filter((_, i) => i !== index)),
    reset: () => { setItems([]); setError(null); },
    // One at a time: the API issues one live upload ticket per user (`storage.upload.active_per_user`).
    uploadAll: async (): Promise<AttachmentInput[]> => {
      const done: AttachmentInput[] = [];
      for (const photo of items) done.push(await uploadForumPhoto(photo));
      return done;
    },
  };
}

export type ForumAttachments = ReturnType<typeof useForumAttachments>;

/** Paperclip → Galeri / Kamera. */
export function AttachButton({ picker, disabled }: { picker: ForumAttachments; disabled?: boolean }) {
  const t = useTranslations("community");
  const tAnalysis = useTranslations("analysis");
  const { palette } = useThemeTokens();
  const [open, setOpen] = useState(false);
  const full = picker.items.length >= FORUM_MAX_ATTACHMENTS;
  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel={t("attach")} disabled={disabled}
        accessibilityState={{ disabled: Boolean(disabled) }}
        onPress={() => {
          haptics.selection();
          if (full) picker.setError(t("attach_too_many", { max: FORUM_MAX_ATTACHMENTS }));
          else setOpen(true);
        }}
        style={[styles.attachBtn, { opacity: disabled ? 0.4 : 1 }]}>
        <PaperclipIcon size={22} color={palette.secondary} strokeWidth={1.75} />
      </Pressable>
      <ActionSheet title={open ? t("attach") : null} onClose={() => setOpen(false)} actions={[
        { label: tAnalysis("entry_photo_gallery"), onPress: () => void picker.pick("gallery") },
        { label: tAnalysis("entry_photo_camera"), onPress: () => void picker.pick("camera") },
      ]} />
    </>
  );
}

/** Picked photos as small thumbnails with a remove ✕, plus the picker's error line. */
export function AttachmentStrip({ picker, disabled }: { picker: ForumAttachments; disabled?: boolean }) {
  const t = useTranslations("community");
  const { palette, radii } = useThemeTokens();
  if (picker.items.length === 0 && !picker.error) return null;
  return (
    <View style={{ gap: 6 }}>
      {picker.items.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip} keyboardShouldPersistTaps="handled">
          {picker.items.map((photo, i) => (
            <View key={photo.uri + i}>
              <Image source={{ uri: photo.uri }} contentFit="cover" accessible={false}
                style={[styles.thumb, { borderRadius: radii.inner, borderColor: palette.border }]} />
              <Pressable accessibilityRole="button" accessibilityLabel={t("attach_remove")} disabled={disabled}
                onPress={() => picker.remove(i)} hitSlop={8} style={styles.remove}>
                <CloseCircleIcon size={22} color={palette.main} />
              </Pressable>
            </View>
          ))}
        </ScrollView>
      ) : null}
      {picker.error ? <AppText variant="caption" tone="danger">{picker.error}</AppText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  attachBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  strip: { gap: 10, paddingTop: 10, paddingRight: 10 },
  thumb: { width: 64, height: 64, borderWidth: 1 },
  remove: { position: "absolute", top: -6, right: -6, backgroundColor: "transparent" },
});
