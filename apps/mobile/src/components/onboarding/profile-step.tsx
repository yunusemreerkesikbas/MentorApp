import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { AddIcon } from "@solar-icons/react-native/linear/add";
import { GalleryAddIcon } from "@solar-icons/react-native/bold/gallery-add";
import { ApiClientError, usersControllerUpdateMe } from "@mentor/api-client";
import type { AuthUser } from "@mentor/types";
import { updateMeSchema, usernameSchema } from "@mentor/validation";
import { AVATAR_MAX_BYTES, AVATAR_TYPES, AvatarUploadError, uploadAvatar } from "../../lib/avatar-upload.js";
import { devicePhotoSize, pickDevicePhoto, type DevicePhoto } from "../../lib/device-photo.js";
import { haptics } from "../../lib/haptics.js";
import { useAuth } from "../../providers/auth-provider.js";
import { useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { AppText, Button, TextField } from "../ui/index.js";
import { PlayError, PlayStepLayout, PuhuBubble } from "../onboarding-play/index.js";

/**
 * The web's `ProfileStep`: username (required) and photo (optional), saved with one PATCH.
 * A failed photo upload never holds the username back: it saves, the photo error stays on the
 * step, and the next "Devam" moves on.
 */
export function ProfileStep({
  user, progress, onBack, onSaved,
}: {
  user: AuthUser;
  progress: { done: number; total: number } | null;
  onBack: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("play");
  const { setUserFromServer } = useAuth();
  const { palette, space } = useThemeTokens();
  const [username, setUsername] = useState(user.username ?? "");
  const [photo, setPhoto] = useState<DevicePhoto | null>(null);
  const [saving, setSaving] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const parsed = usernameSchema.safeParse(username);
  const avatarSrc = photo?.uri ?? user.avatarUrl;

  const choose = async () => {
    try {
      const picked = await pickDevicePhoto("gallery");
      if (!picked) return;
      if (!AVATAR_TYPES.has(picked.mimeType)) return setPhotoError(t("profile_avatar_type_error"));
      if (devicePhotoSize(picked) > AVATAR_MAX_BYTES) return setPhotoError(t("profile_avatar_too_big"));
      setPhoto(picked);
      setPhotoError(null);
    } catch {
      setPhotoError(t("profile_avatar_type_error"));
    }
  };

  const save = async () => {
    if (!parsed.success || saving) return;
    const usernameChanged = user.username !== parsed.data;
    if (!usernameChanged && !photo) return onSaved();
    setSaving(true);
    setErrorMessage(null);
    setUsernameError(null);
    let photoFailed = false;
    try {
      let avatarStorageKey: string | undefined;
      if (photo) {
        try {
          avatarStorageKey = await uploadAvatar(photo);
        } catch (err) {
          photoFailed = true;
          setPhoto(null);
          setPhotoError(t(err instanceof AvatarUploadError && err.reason === "too_big" ? "profile_avatar_too_big" : "profile_avatar_upload_error"));
        }
      }
      if (usernameChanged || avatarStorageKey) {
        const payload = updateMeSchema.parse({
          ...(usernameChanged ? { username: parsed.data } : {}),
          ...(avatarStorageKey ? { avatarStorageKey } : {}),
        });
        const updated = (await usersControllerUpdateMe(payload)) as unknown as AuthUser;
        setUserFromServer(updated);
      }
      if (photoFailed) {
        haptics.error();
        return;
      }
      haptics.success();
      onSaved();
    } catch (err) {
      haptics.error();
      if (err instanceof ApiClientError && err.body.code === "AUTH_USERNAME_IN_USE") {
        setUsernameError(err.body.message);
        return;
      }
      setErrorMessage(err instanceof ApiClientError ? err.body.message : t("profile_save_error"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <PlayStepLayout
      progress={progress}
      onBack={onBack}
      busy={saving}
      heading={<PuhuBubble title={t("profile_title")} />}
      footer={
        <>
          <PlayError message={errorMessage} />
          <Button label={t("profile_continue")} disabled={!parsed.success} loading={saving} onPress={() => void save()} />
        </>
      }
    >
      <View style={{ gap: space.xl }}>
        <View style={styles.pickerWrap}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={avatarSrc ? t("profile_avatar_change") : t("profile_avatar_add")}
            disabled={saving}
            onPress={() => void choose()}
            style={styles.picker}
          >
            <View style={[styles.avatar, { borderColor: palette.ctaPlayBg, backgroundColor: palette.playSelected }]}>
              {avatarSrc ? (
                <Image source={{ uri: avatarSrc }} style={styles.avatarImage} contentFit="cover" accessible={false} />
              ) : (
                <GalleryAddIcon size={32} color={palette.playSelectedInk} />
              )}
              <View style={[styles.plus, { backgroundColor: palette.ctaPlayBg, borderColor: palette.surface }]}>
                <AddIcon size={16} color={palette.ctaPlayInk} />
              </View>
            </View>
            <AppText style={[styles.pickerText, { color: palette.playSelectedInk }]}>
              {avatarSrc ? t("profile_avatar_change") : t("profile_avatar_add")}
            </AppText>
          </Pressable>
          <PlayError message={photoError} />
        </View>
        <TextField
          label={t("profile_username_label")}
          placeholder={t("profile_username_placeholder")}
          value={username}
          editable={!saving}
          onChangeText={(value) => {
            setUsername(value.toLowerCase());
            setErrorMessage(null);
            setUsernameError(null);
          }}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username"
          maxLength={24}
          hint={t("profile_username_hint")}
          errorMessage={usernameError}
        />
      </View>
    </PlayStepLayout>
  );
}

const styles = StyleSheet.create({
  pickerWrap: { alignItems: "center", gap: 4 },
  picker: { alignItems: "center", gap: 4 },
  avatar: { width: 96, height: 96, borderRadius: 48, borderWidth: 2, borderStyle: "dashed", alignItems: "center", justifyContent: "center" },
  avatarImage: { width: "100%", height: "100%", borderRadius: 48 },
  plus: { position: "absolute", right: -2, bottom: -2, width: 32, height: 32, borderRadius: 16, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  pickerText: { minHeight: 44, textAlignVertical: "center", fontSize: 14, fontWeight: "700" },
});
