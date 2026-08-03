"use client";
import { ImagePlus, Trash2 } from "lucide-react";

import {
  useEffect,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { useTranslations } from "next-intl";
import { updateMeSchema, usernameSchema } from "@mentor/validation";
import { ApiClientError, usersControllerUpdateMe } from "@mentor/api-client";
import type { AuthUser } from "@mentor/types";
import { TextField } from "@mentor/ui";
import { FormError } from "@/components/form";
import {
  createAvatarUploadUrl,
  putAvatarToSignedUrl,
  resolveAvatarUrl,
} from "@/lib/avatar";
import { useAuth } from "@/lib/auth-context";
import { OnboardingStepLayout } from "../onboarding-step-layout";

const PROFILE_FORM_ID = "onboarding-profile-form";
const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
const AVATAR_TYPES = new Set(["image/jpeg", "image/png"]);

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function AvatarPreview({
  name,
  src,
}: {
  name: string;
  src: string | null;
}) {
  if (src) {
    return (
      // ponytail: signed/fake object URLs already resolve publicly; plain img avoids next/image config.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        className="size-14 rounded-full border-[3px] border-white object-cover"
      />
    );
  }

  return (
    <div
      className="grid size-14 place-items-center rounded-full border-[3px] border-white text-xl font-bold"
      style={{
        backgroundColor: "#D6DBFD",
        color: "var(--color-main)",
        fontFamily: "var(--font-heading)",
      }}
      aria-hidden
    >
      {initials(name)}
    </div>
  );
}

export function ProfileStep({
  user,
  onBack,
  onSaved,
}: {
  user: AuthUser;
  onBack: () => void;
  onSaved: (user: AuthUser) => void;
}) {
  const t = useTranslations("onboarding.profile");
  const { setUserFromServer } = useAuth();
  const [username, setUsername] = useState(user.username ?? "");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
    };
  }, [avatarPreviewUrl]);

  const parsedUsername = usernameSchema.safeParse(username);
  const canSave = parsedUsername.success && !saving;
  const avatarSrc = removeAvatar
    ? null
    : (avatarPreviewUrl ?? resolveAvatarUrl(user.avatarUrl));

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
    setAvatarPreviewUrl(URL.createObjectURL(file));
    setRemoveAvatar(false);
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
    const usernameResult = usernameSchema.safeParse(username);
    if (!usernameResult.success || saving) {
      setUsernameError(t("form_error"));
      return;
    }
    if (user.username === usernameResult.data && !avatarFile && !removeAvatar) {
      onSaved(user);
      return;
    }

    setSaving(true);
    setError(null);
    setUsernameError(null);
    try {
      const parsed = updateMeSchema.safeParse({
        username: usernameResult.data,
        ...(removeAvatar && { avatarStorageKey: null }),
      });
      if (!parsed.success) {
        throw new Error(t("form_error"));
      }

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
      setUserFromServer(updated);
      onSaved(updated);
    } catch (err) {
      if (
        err instanceof ApiClientError &&
        err.body.code === "AUTH_USERNAME_IN_USE"
      ) {
        setUsernameError(err.body.message);
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
    <OnboardingStepLayout
      step={1}
      mascot="winking"
      title={t("title")}
      subtitle={t("subtitle")}
      onBack={onBack}
      primaryLabel={t("continue")}
      primaryFormId={PROFILE_FORM_ID}
      primaryBusy={saving}
      primaryDisabled={!canSave}
    >
      <form
        id={PROFILE_FORM_ID}
        className="flex flex-col gap-3"
        onSubmit={(event) => void handleSubmit(event)}
      >
        <FormError message={error} />
        <TextField
          label={t("username_label")}
          value={username}
          onChange={(event) => {
            setUsername(event.target.value);
            setUsernameError(null);
          }}
          autoFocus
          required
          maxLength={24}
          disabled={saving}
          placeholder={t("username_placeholder")}
          error={usernameError}
        />
        <p className="-mt-1 text-xs leading-relaxed text-[var(--color-secondary)]">
          {t("username_hint")}
        </p>

        <div className="flex items-center gap-3 rounded-[var(--radius-card)] border border-white/80 bg-white/35 p-3">
          <AvatarPreview name={user.displayName} src={avatarSrc} />
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
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <label className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-[var(--radius-card)] border border-black/10 bg-white/70 px-3 py-2 text-sm font-semibold text-[var(--color-main)] transition hover:bg-white focus-within:outline-none focus-within:ring-2 focus-within:ring-[var(--color-focus-ring)]">
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
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-[var(--radius-card)] px-2.5 py-2 text-sm font-semibold text-[var(--color-secondary)] transition hover:bg-white/70 hover:text-[var(--color-main)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={saving}
                  onClick={handleRemoveAvatar}
                >
                  <Trash2 size={15} aria-hidden />
                  {t("avatar_remove")}
                </button>
              ) : null}
            </div>
            <p className="mt-1 text-xs leading-snug text-[var(--color-secondary)]">
              {t("avatar_hint")}
            </p>
          </div>
        </div>
      </form>
    </OnboardingStepLayout>
  );
}
