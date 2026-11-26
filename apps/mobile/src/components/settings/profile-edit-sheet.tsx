import { useState } from "react";
import { Image } from "expo-image";
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { UserIcon } from "@solar-icons/react-native/bold/user";
import { GalleryAddIcon } from "@solar-icons/react-native/bold/gallery-add";
import { TrashBinTrashIcon } from "@solar-icons/react-native/linear/trash-bin-trash";
import { ApiClientError, http, usersControllerUpdateMe } from "@mentor/api-client";
import type { AuthUser, AvatarUploadUrlDto } from "@mentor/types";
import { updateMeSchema } from "@mentor/validation";
import { cardShadow } from "../../lib/layout.js";
import { devicePhotoSize, pickDevicePhoto, putDevicePhoto, type DevicePhoto } from "../../lib/device-photo.js";
import { haptics } from "../../lib/haptics.js";
import { getApiBaseUrl } from "../../lib/env.js";
import { useAuth } from "../../providers/auth-provider.js";
import { useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { useToast } from "../../providers/toast-provider.js";
import { FormSheet } from "../panel/primitives.js";
import { AppText, Button, TextField } from "../ui/index.js";

const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
const AVATAR_TYPES = new Set(["image/jpeg", "image/png"]);
const BIO_MAX = 200;

const isReauthRequired = (err: unknown) =>
  err instanceof ApiClientError && err.status === 403 && err.body.code === "AUTH_REAUTHENTICATION_REQUIRED";

/** The web's `ProfileEditForm` in the same titled sheet: avatar, name, username, about, website, email. */
export function ProfileEditSheet({ user, onClose }: { user: AuthUser; onClose: () => void }) {
  const t = useTranslations("settings");
  const router = useRouter();
  const toast = useToast();
  const { setUserFromServer, logout } = useAuth();
  const { palette, radii, space } = useThemeTokens();
  const [displayName, setDisplayName] = useState(user.displayName);
  const [username, setUsername] = useState(user.username ?? "");
  const [bio, setBio] = useState(user.bio ?? "");
  const [website, setWebsite] = useState(user.website ?? "");
  const [email, setEmail] = useState(user.email);
  const [photo, setPhoto] = useState<DevicePhoto | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const previewUrl = photo ? photo.uri : removeAvatar ? null : user.avatarUrl;

  async function choosePhoto() {
    try {
      const picked = await pickDevicePhoto("gallery");
      if (!picked) return;
      if (!AVATAR_TYPES.has(picked.mimeType)) return setError(t("edit_avatar_type_error"));
      if (devicePhotoSize(picked) > AVATAR_MAX_BYTES) return setError(t("edit_avatar_too_big"));
      setPhoto(picked);
      setRemoveAvatar(false);
      setError(null);
    } catch {
      setError(t("edit_avatar_type_error"));
    }
  }

  async function signInAgain(message: string) {
    onClose();
    await logout().catch(() => undefined);
    toast.show(message);
    router.replace("/(auth)/login" as never);
  }

  async function save() {
    const trimmedUsername = username.trim();
    const trimmedEmail = email.trim().toLowerCase();
    const emailChanged = trimmedEmail !== user.email.toLowerCase();
    const parsed = updateMeSchema.safeParse({
      displayName: displayName.trim(),
      ...((trimmedUsername || user.username) && { username: trimmedUsername }),
      ...(emailChanged && { email: trimmedEmail }),
      ...(removeAvatar && { avatarStorageKey: null }),
      bio: bio.trim(),
      website: website.trim(),
    });
    if (!parsed.success) {
      setError(parsed.error.issues.some((issue) => issue.path[0] === "email") ? t("edit_email_error") : t("edit_form_error"));
      return;
    }

    setSaving(true);
    setError(null);
    try {
      let payload = parsed.data;
      if (photo) {
        const upload = (await http<AvatarUploadUrlDto>("/v1/users/me/avatar-upload-url", {
          method: "POST",
          body: JSON.stringify({ contentType: photo.mimeType }),
        })) as AvatarUploadUrlDto;
        if (devicePhotoSize(photo) > upload.maxBytes) throw new Error(t("edit_avatar_too_big"));
        if (!(await putDevicePhoto(new URL(upload.uploadUrl, getApiBaseUrl()).toString(), photo))) throw new Error(t("edit_avatar_upload_error"));
        payload = { ...payload, avatarStorageKey: upload.key };
      }
      const updated = (await usersControllerUpdateMe(payload)) as unknown as AuthUser;
      if (emailChanged) {
        await signInAgain(t("edit_email_changed"));
        return;
      }
      setUserFromServer(updated);
      haptics.success();
      toast.show(t("edit_saved"));
      onClose();
    } catch (err) {
      if (isReauthRequired(err)) {
        await signInAgain(t("edit_reauth"));
        return;
      }
      haptics.error();
      setError(err instanceof ApiClientError ? err.body.message : err instanceof Error ? err.message : t("edit_save_error"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormSheet visible title={t("edit_title")} closeLabel={t("edit_close")} onClose={onClose} closeDisabled={saving}
      footer={(
        <View style={{ flexDirection: "row", gap: space.sm, padding: space.lg }}>
          <View style={{ flex: 1 }}><Button label={t("edit_cancel")} variant="secondary" disabled={saving} onPress={onClose} /></View>
          <View style={{ flex: 1 }}><Button label={t("edit_save")} loading={saving} onPress={() => void save()} /></View>
        </View>
      )}>
      <View style={{ gap: space.md }}>
        {error ? <AppText variant="caption" tone="danger" accessibilityRole="alert">{error}</AppText> : null}
        <View style={[cardShadow, {
          flexDirection: "row", alignItems: "center", gap: space.md, padding: space.md,
          borderRadius: radii.card, backgroundColor: palette.surface,
        }]}>
          <View style={{
            width: 64, height: 64, borderRadius: 32, overflow: "hidden", borderWidth: 2,
            borderColor: palette.border, backgroundColor: palette.surfaceAlt, alignItems: "center", justifyContent: "center",
          }}>
            {previewUrl ? <Image source={{ uri: previewUrl }} contentFit="cover" accessible={false} style={{ width: "100%", height: "100%" }} />
              : <UserIcon size={32} color={palette.muted} />}
          </View>
          <View style={{ flex: 1, minWidth: 0, gap: space.xs }}>
            <AppText variant="caption" tone="secondary" style={{ fontWeight: "700" }}>{t("edit_avatar_label")}</AppText>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
              <PhotoButton label={t("edit_avatar_change")} icon={<GalleryAddIcon size={18} color={palette.main} />}
                disabled={saving} onPress={() => void choosePhoto()} />
              {previewUrl ? (
                <PhotoButton label={t("edit_avatar_remove")} icon={<TrashBinTrashIcon size={18} color={palette.danger} />}
                  danger disabled={saving} onPress={() => { setPhoto(null); setRemoveAvatar(true); setError(null); }} />
              ) : null}
            </View>
            <AppText variant="caption" tone="secondary">{t("edit_avatar_hint")}</AppText>
          </View>
        </View>
        <TextField label={t("edit_name_label")} value={displayName} onChangeText={setDisplayName} autoComplete="name" maxLength={64} />
        <TextField label={t("edit_username_label")} value={username} onChangeText={setUsername}
          autoCapitalize="none" autoCorrect={false} autoComplete="username" />
        <TextField label={t("edit_bio_label")} placeholder={t("edit_bio_placeholder")} value={bio} onChangeText={setBio}
          multiline maxLength={BIO_MAX} textAlignVertical="top" style={{ minHeight: 96, paddingTop: space.sm }}
          hint={t("edit_bio_count", { count: bio.length })} />
        <TextField label={t("edit_website_label")} placeholder={t("edit_website_placeholder")} value={website}
          onChangeText={setWebsite} autoCapitalize="none" autoCorrect={false} keyboardType="url" />
        <TextField label={t("edit_email_label")} value={email} onChangeText={setEmail}
          autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" />
      </View>
    </FormSheet>
  );
}

function PhotoButton({ label, icon, onPress, disabled, danger }: {
  label: string; icon: React.ReactNode; onPress: () => void; disabled?: boolean; danger?: boolean;
}) {
  const { palette, radii, space } = useThemeTokens();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} disabled={disabled}
      style={({ pressed }) => [cardShadow, {
        minHeight: 44, flexDirection: "row", alignItems: "center", gap: space.xs, paddingHorizontal: space.md,
        borderRadius: radii.inner, opacity: disabled ? 0.5 : 1,
        backgroundColor: pressed ? palette.surfaceAlt : palette.surface,
      }]}>
      {icon}
      <AppText variant="body" tone={danger ? "danger" : "main"} style={{ fontWeight: "700" }}>{label}</AppText>
    </Pressable>
  );
}
