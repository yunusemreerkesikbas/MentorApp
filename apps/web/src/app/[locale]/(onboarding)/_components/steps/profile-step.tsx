"use client";

import { Camera, Plus } from "lucide-react";
import { useEffect, useId, useState, type ChangeEvent, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { ApiClientError, usersControllerUpdateMe } from "@mentor/api-client";
import type { AuthUser } from "@mentor/types";
import { updateMeSchema, usernameSchema } from "@mentor/validation";
import { PlayButton } from "@/components/onboarding-play/play-button";
import { PlayFooter } from "@/components/onboarding-play/play-footer";
import { PuhuBubble } from "@/components/onboarding-play/play-heading";
import { createAvatarUploadUrl, putAvatarToSignedUrl, resolveAvatarUrl } from "@/lib/avatar";
import { useAuth } from "@/lib/auth-context";
import { OnboardingStepLayout } from "../onboarding-step-layout";

const FORM_ID = "onboarding-profile-form";
const MAX_BYTES = 2 * 1024 * 1024;
const TYPES = new Set(["image/jpeg", "image/png"]);

/** Username (required) and photo (optional) on one screen, saved with one PATCH. */
export function ProfileStep({
  user,
  progress,
  onBack,
  onSaved,
}: {
  user: AuthUser;
  progress: { done: number; total: number } | null;
  onBack: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("onboarding.profile");
  const { setUserFromServer } = useAuth();
  const inputId = useId();
  const [username, setUsername] = useState(user.username ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const parsed = usernameSchema.safeParse(username);
  const avatarSrc = preview ?? resolveAvatarUrl(user.avatarUrl);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  function choose(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.files?.[0];
    event.target.value = "";
    if (!next) return;
    if (!TYPES.has(next.type)) return setError(t("avatar_type_error"));
    if (next.size > MAX_BYTES) return setError(t("avatar_too_big"));
    setFile(next);
    setPreview(URL.createObjectURL(next));
    setError(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!parsed.success || saving) return;
    const usernameChanged = user.username !== parsed.data;
    if (!usernameChanged && !file) return onSaved();
    setSaving(true);
    setError(null);
    setUsernameError(null);
    try {
      let avatarStorageKey: string | undefined;
      if (file) {
        const contentType = file.type as "image/jpeg" | "image/png";
        const upload = await createAvatarUploadUrl(contentType);
        if (file.size > upload.maxBytes) return setError(t("avatar_too_big"));
        await putAvatarToSignedUrl(upload.uploadUrl, file, contentType);
        avatarStorageKey = upload.key;
      }
      const payload = updateMeSchema.parse({
        ...(usernameChanged ? { username: parsed.data } : {}),
        ...(avatarStorageKey ? { avatarStorageKey } : {}),
      });
      const updated = (await usersControllerUpdateMe(payload)) as unknown as AuthUser;
      setUserFromServer(updated);
      onSaved();
    } catch (err) {
      if (err instanceof ApiClientError && err.body.code === "AUTH_USERNAME_IN_USE") {
        setUsernameError(err.body.message);
        return;
      }
      setError(err instanceof ApiClientError ? err.body.message : t(file ? "avatar_upload_error" : "save_error"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <OnboardingStepLayout
      progress={progress}
      onBack={onBack}
      heading={<PuhuBubble title={t("title")} />}
      footer={
        <PlayFooter error={error}>
          <PlayButton type="submit" form={FORM_ID} busy={saving} disabled={!parsed.success}>
            {t("continue")}
          </PlayButton>
        </PlayFooter>
      }
    >
      <form id={FORM_ID} onSubmit={(event) => void submit(event)} className="flex flex-col gap-5">
        <label className="flex cursor-pointer flex-col items-center gap-1 self-center">
          <span className="relative flex size-24 items-center justify-center rounded-full border-2 border-dashed border-[var(--play-cta)] bg-[var(--play-selected)] text-[var(--play-selected-ink)] has-[+input:focus-visible]:ring-2">
            {avatarSrc ? (
              // Signed R2 URLs and blob previews are not Next Image remote patterns.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarSrc} alt="" className="size-full rounded-full object-cover" />
            ) : (
              <Camera size={32} aria-hidden />
            )}
            <span
              aria-hidden
              className="absolute -bottom-0.5 -right-0.5 flex size-8 items-center justify-center rounded-full border-2 border-[var(--color-surface)] bg-[var(--play-cta)] text-[var(--play-cta-ink)]"
            >
              <Plus size={16} strokeWidth={3} />
            </span>
          </span>
          <span className="flex min-h-11 items-center rounded-[var(--play-radius)] px-2 text-sm font-bold text-[var(--play-selected-ink)] [label:has(input:focus-visible)_&]:ring-2 [label:has(input:focus-visible)_&]:ring-[var(--color-focus-ring)]">
            {avatarSrc ? t("avatar_change") : t("avatar_add")}
          </span>
          <input type="file" accept="image/jpeg,image/png" className="sr-only" disabled={saving} onChange={choose} />
        </label>

        <div className="flex flex-col gap-2">
          <label htmlFor={inputId} className="text-sm font-bold text-[var(--color-main)]">
            {t("username_label")}
          </label>
          <div
            className={`flex h-14 items-center gap-1 rounded-[var(--play-radius)] border-2 bg-[var(--color-surface)] px-4 focus-within:border-[var(--play-cta)] ${usernameError ? "border-[var(--color-danger)]" : "border-[var(--play-line)]"}`}
          >
            <span aria-hidden className="text-base font-bold text-[var(--color-secondary)]">
              @
            </span>
            <input
              id={inputId}
              value={username}
              maxLength={24}
              required
              disabled={saving}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              placeholder={t("username_placeholder")}
              aria-invalid={usernameError ? true : undefined}
              aria-describedby={usernameError ? `${inputId}-error ${inputId}-hint` : `${inputId}-hint`}
              onChange={(event) => {
                setUsername(event.target.value);
                setError(null);
                setUsernameError(null);
              }}
              className="min-w-0 flex-1 bg-transparent text-base font-medium text-[var(--color-body)] outline-none placeholder:text-[var(--color-secondary)]"
            />
          </div>
          {usernameError ? (
            <p id={`${inputId}-error`} role="alert" className="text-sm font-semibold text-[var(--color-danger)]">
              {usernameError}
            </p>
          ) : null}
          <p id={`${inputId}-hint`} className="text-sm font-medium text-[var(--color-secondary)]">
            {t("username_hint")}
          </p>
        </div>
      </form>
    </OnboardingStepLayout>
  );
}
