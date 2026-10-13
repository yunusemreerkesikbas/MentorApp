"use client";

import { GalleryAddIcon as ImagePlus } from "@solar-icons/react/bold/gallery-add";
import { TrashBinTrashIcon as Trash2 } from "@solar-icons/react/linear/trash-bin-trash";
import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { updateMeSchema } from "@mentor/validation";
import { ApiClientError, usersControllerUpdateMe } from "@mentor/api-client";
import { Button, TextAreaField, TextField } from "@mentor/ui";
import type { AuthUser } from "@mentor/types";
import { FormError } from "@/components/form";
import { UserAvatar } from "@/components/user-avatar";
import { createAvatarUploadUrl, putAvatarToSignedUrl, resolveAvatarUrl } from "@/lib/avatar";
import { isReauthenticationRequired } from "@/lib/account-security";
import { useMentorToast } from "@/lib/mentor-toast";

const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
const AVATAR_TYPES = new Set(["image/jpeg", "image/png"]);

export function ProfileAvatar({
  alt,
  overrideUrl,
  size = "lg",
  user,
}: {
  alt: string;
  overrideUrl?: string | null;
  size?: "lg" | "md";
  user: AuthUser;
}) {
  const src = overrideUrl === undefined ? resolveAvatarUrl(user.avatarUrl) : overrideUrl;
  return <UserAvatar alt={alt} frame="strong" name={user.displayName} size={size === "lg" ? 112 : 64} src={src} className="shadow-[var(--shadow-card)]" />;
}

export function ProfileEditForm({
  onCancel,
  onSaved,
  onSignInAgain,
  user,
}: {
  onCancel: () => void;
  onSaved: (user: AuthUser) => void;
  onSignInAgain: (reason: "reauth" | "emailchanged") => Promise<void>;
  user: AuthUser;
}) {
  const t = useTranslations("profile.edit");
  const toast = useMentorToast();
  const [displayName, setDisplayName] = useState(user.displayName);
  const [email, setEmail] = useState(user.email);
  const [username, setUsername] = useState(user.username ?? "");
  const [bio, setBio] = useState(user.bio ?? "");
  const [website, setWebsite] = useState(user.website ?? "");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    return () => {
      if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
    };
  }, [avatarPreviewUrl]);

  function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!AVATAR_TYPES.has(file.type)) {
      setError(t("avatar_type_error"));
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      setError(t("avatar_too_big"));
      return;
    }
    setAvatarFile(file);
    setRemoveAvatar(false);
    setAvatarPreviewUrl(URL.createObjectURL(file));
    setError(null);
  }

  function handleRemoveAvatar() {
    setAvatarFile(null);
    setAvatarPreviewUrl(null);
    setRemoveAvatar(true);
    setError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedUsername = username.trim();
    const trimmedEmail = email.trim().toLowerCase();
    const emailChanged = trimmedEmail !== user.email.toLowerCase();
    const patch = {
      displayName: displayName.trim(),
      ...((trimmedUsername || user.username) && { username: trimmedUsername }),
      ...(emailChanged && { email: trimmedEmail }),
      ...(removeAvatar && { avatarStorageKey: null }),
      bio: bio.trim(),
      website: website.trim(),
    };
    const parsed = updateMeSchema.safeParse(patch);
    if (!parsed.success) {
      const emailInvalid = parsed.error.issues.some((issue) => issue.path[0] === "email");
      setError(emailInvalid ? t("email_error") : t("form_error"));
      return;
    }

    setSaving(true);
    setError(null);
    try {
      let payload = parsed.data;
      if (avatarFile) {
        const contentType = avatarFile.type as "image/jpeg" | "image/png";
        const upload = await createAvatarUploadUrl(contentType);
        if (avatarFile.size > upload.maxBytes) {
          throw new Error(t("avatar_too_big"));
        }
        try {
          await putAvatarToSignedUrl(upload.uploadUrl, avatarFile, contentType);
        } catch {
          throw new Error(t("avatar_upload_error"));
        }
        const avatarPatch = updateMeSchema.safeParse({
          ...payload,
          avatarStorageKey: upload.key,
        });
        if (!avatarPatch.success) {
          throw new Error(t("avatar_upload_error"));
        }
        payload = avatarPatch.data;
      }

      const updated = (await usersControllerUpdateMe(payload)) as unknown as AuthUser;
      if (emailChanged) {
        onCancel();
        await onSignInAgain("emailchanged");
        return;
      }
      onSaved(updated);
      toast.success({
        title: t("saved_title"),
        message: t("saved_message"),
        duration: 3000,
      });
    } catch (err) {
      if (isReauthenticationRequired(err)) {
        onCancel();
        await onSignInAgain("reauth");
        return;
      }
      setError(
        err instanceof ApiClientError
          ? err.body.message
          : err instanceof Error
            ? err.message
            : t("save_error"),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => void handleSubmit(event)}
    >
      {error ? <FormError message={error} /> : null}
      <div className="flex items-center gap-3 rounded-[var(--radius-card)] bg-[color-mix(in_srgb,var(--color-surface)_45%,transparent)] p-3 shadow-[var(--shadow-card)]">
        <ProfileAvatar
          alt={t("avatar_alt", { name: user.displayName })}
          overrideUrl={removeAvatar ? null : (avatarPreviewUrl ?? undefined)}
          size="md"
          user={user}
        />
        <div className="min-w-0 flex-1">
          <p
            className="text-xs font-semibold"
            style={{
              color: "var(--color-secondary)",
              fontFamily: "var(--font-heading)",
            }}
          >
            {t("avatar_label")}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm font-bold text-[var(--color-main)] shadow-[var(--shadow-card)] transition-colors hover:bg-[color-mix(in_srgb,var(--color-main)_4%,transparent)] focus-within:outline-none focus-within:ring-2 focus-within:ring-[var(--color-focus-ring)]">
              <ImagePlus size={16} aria-hidden />
              {t("avatar_change")}
              <input
                className="sr-only"
                type="file"
                accept="image/jpeg,image/png"
                disabled={saving}
                onChange={handleAvatarChange}
              />
            </label>
            {user.avatarUrl || avatarPreviewUrl ? (
              <button
                type="button"
                className="inline-flex min-h-10 items-center gap-2 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm font-bold text-[var(--color-secondary)] shadow-[var(--shadow-card)] transition-colors hover:border-[color-mix(in_srgb,var(--color-danger)_40%,var(--color-border))] hover:bg-[color-mix(in_srgb,var(--color-danger)_5%,transparent)] hover:text-[var(--color-danger)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={saving}
                onClick={handleRemoveAvatar}
              >
                <Trash2 size={16} aria-hidden />
                {t("avatar_remove")}
              </button>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-[var(--color-secondary)]">
            {t("avatar_hint")}
          </p>
        </div>
      </div>
      <TextField
        label={t("name_label")}
        value={displayName}
        onChange={(event) => setDisplayName(event.target.value)}
        disabled={saving}
        maxLength={64}
        autoFocus
      />
      <TextField
        label={t("username_label")}
        value={username}
        onChange={(event) => setUsername(event.target.value)}
        disabled={saving}
        maxLength={24}
      />
      <TextAreaField
        label={t("bio_label")}
        value={bio}
        onChange={(event) => setBio(event.target.value)}
        disabled={saving}
        maxLength={200}
        rows={3}
        placeholder={t("bio_placeholder")}
        hint={`${bio.trim().length}/200`}
      />
      <TextField
        label={t("website_label")}
        value={website}
        onChange={(event) => setWebsite(event.target.value)}
        disabled={saving}
        maxLength={200}
        type="url"
        inputMode="url"
        placeholder={t("website_placeholder")}
      />
      <TextField
        label={t("email_label")}
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        disabled={saving}
        type="email"
        inputMode="email"
        maxLength={254}
        autoComplete="email"
      />
      <div className="grid grid-cols-2 gap-3 pt-2">
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          disabled={saving}
          fullWidth
        >
          {t("cancel")}
        </Button>
        <Button type="submit" busy={saving} fullWidth>
          {t("save")}
        </Button>
      </div>
    </form>
  );
}

