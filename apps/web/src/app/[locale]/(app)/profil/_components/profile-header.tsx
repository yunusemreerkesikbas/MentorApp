"use client";

import {
  useEffect,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { useTranslations } from "next-intl";
import { updateMeSchema } from "@mentor/validation";
import {
  ApiClientError,
  usersControllerResendVerificationEmail,
  usersControllerUpdateMe,
} from "@mentor/api-client";
import { Button, TextField, useDialog } from "@mentor/ui";
import type { AuthUser } from "@mentor/types";
import BadgeCheck from "lucide-react/dist/esm/icons/badge-check.mjs";
import ImagePlus from "lucide-react/dist/esm/icons/image-plus.mjs";
import LoaderCircle from "lucide-react/dist/esm/icons/loader-circle.mjs";
import MailWarning from "lucide-react/dist/esm/icons/mail-warning.mjs";
import LockKeyhole from "lucide-react/dist/esm/icons/lock-keyhole.mjs";
import Pencil from "lucide-react/dist/esm/icons/pencil.mjs";
import Trash2 from "lucide-react/dist/esm/icons/trash-2.mjs";
import { FormError } from "@/components/form";
import {
  createAvatarUploadUrl,
  putAvatarToSignedUrl,
  resolveAvatarUrl,
} from "@/lib/avatar";
import { useMentorBottomSheet } from "@/lib/mentor-bottom-sheet";
import { useMentorToast } from "@/lib/mentor-toast";

const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
const AVATAR_TYPES = new Set(["image/jpeg", "image/png"]);

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function ProfileAvatar({
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
  const sizeClass = size === "lg" ? "size-28 text-4xl" : "size-16 text-2xl";

  if (src) {
    return (
      // ponytail: next/image breaks this fake-object URL in dev; plain img is the direct public object.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        className={`${sizeClass} rounded-full border-4 border-white object-cover shadow-[var(--shadow-card)]`}
      />
    );
  }

  return (
    <div
      className={`grid ${sizeClass} place-items-center rounded-full border-4 border-white font-bold shadow-[var(--shadow-card)]`}
      style={{
        backgroundColor: "#D6DBFD",
        color: "var(--color-main)",
        fontFamily: "var(--font-heading)",
      }}
      aria-hidden
    >
      {initials(user.displayName)}
    </div>
  );
}

/**
 * Profile identity row — Nuton thumb placeholder (#D6DBFD) + League Spartan name stack.
 */
export function ProfileHeader({
  onSaved,
  user,
}: {
  onSaved: (user: AuthUser) => void;
  user: AuthUser;
}) {
  const t = useTranslations("profile");
  const dialog = useDialog();
  const sheet = useMentorBottomSheet();
  const toast = useMentorToast();
  const [resendingVerification, setResendingVerification] = useState(false);

  function openEditDialog() {
    sheet.show({
      title: t("edit.title"),
      layout: "filter",
      dismissOnBackdrop: false,
      children: (
        <ProfileEditForm
          user={user}
          onCancel={sheet.dismiss}
          onSaved={(next) => {
            onSaved(next);
            sheet.dismiss();
          }}
        />
      ),
    });
  }

  async function resendVerificationEmail() {
    if (resendingVerification) return;
    setResendingVerification(true);
    try {
      await usersControllerResendVerificationEmail();
      dialog.info({
        title: t("verification_sent_title"),
        message: t("verification_sent_message"),
        okLabel: t("verification_sent_ok"),
        closeLabel: t("verification_sent_ok"),
      });
    } catch (err) {
      toast.error({
        title: t("verification_send_error_title"),
        message:
          err instanceof ApiClientError
            ? err.body.message
            : t("verification_send_error_message"),
        duration: 3000,
      });
    } finally {
      setResendingVerification(false);
    }
  }

  return (
    <section className="flex flex-col items-center px-2 pb-1 pt-2 text-center">
      <div className="relative">
        <ProfileAvatar alt={t("edit.avatar_alt", { name: user.displayName })} user={user} />
        <button
          type="button"
          onClick={openEditDialog}
          aria-label={t("edit.action")}
          title={t("edit.action")}
          className="absolute -right-2 top-1 grid min-h-11 min-w-11 place-items-center rounded-full bg-white text-[var(--color-main)] shadow-[var(--shadow-card)] transition-colors hover:bg-black/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
        >
          <Pencil size={17} aria-hidden />
        </button>
        {user.emailVerified ? (
          <span
            role="img"
            aria-label={t("email_verified")}
            title={t("email_verified")}
            className="absolute -right-1 bottom-1 grid size-8 place-items-center rounded-full border-2 border-white bg-white text-[var(--color-main)] shadow-[var(--shadow-card)]"
          >
            <BadgeCheck size={17} strokeWidth={2.2} aria-hidden />
          </span>
        ) : (
          <button
            type="button"
            onClick={() => void resendVerificationEmail()}
            disabled={resendingVerification}
            aria-label={
              resendingVerification
                ? t("verification_sending")
                : t("verification_resend_action")
            }
            title={t("status_unverified")}
            className="absolute -right-2 bottom-0 grid min-h-11 min-w-11 place-items-center rounded-full text-[var(--color-chip-text)] transition hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transform-none motion-reduce:transition-none"
          >
            <span
              className="grid size-8 place-items-center rounded-full border-2 border-white shadow-[var(--shadow-card)]"
              style={{
                backgroundColor:
                  "color-mix(in srgb, var(--color-chip) 38%, white)",
              }}
            >
              {resendingVerification ? (
                <LoaderCircle
                  size={16}
                  strokeWidth={2.4}
                  className="animate-spin motion-reduce:animate-none"
                  aria-hidden
                />
              ) : (
                <MailWarning size={16} strokeWidth={2.2} aria-hidden />
              )}
            </span>
          </button>
        )}
      </div>
      <h1
        className="mt-3 max-w-full break-words text-4xl font-bold leading-none text-balance"
        style={{
          color: "var(--color-main)",
          fontFamily: "var(--font-heading)",
        }}
      >
        {user.displayName}
      </h1>
      <p className="mt-2 max-w-full truncate text-sm text-[var(--color-secondary)]">
        {user.username ? `@${user.username}` : user.email}
      </p>
    </section>
  );
}

function ProfileEditForm({
  onCancel,
  onSaved,
  user,
}: {
  onCancel: () => void;
  onSaved: (user: AuthUser) => void;
  user: AuthUser;
}) {
  const t = useTranslations("profile.edit");
  const toast = useMentorToast();
  const [displayName, setDisplayName] = useState(user.displayName);
  const [username, setUsername] = useState(user.username ?? "");
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
    const patch = {
      displayName: displayName.trim(),
      ...((trimmedUsername || user.username) && { username: trimmedUsername }),
      ...(removeAvatar && { avatarStorageKey: null }),
    };
    const parsed = updateMeSchema.safeParse(patch);
    if (!parsed.success) {
      setError(t("form_error"));
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
      onSaved(updated);
      toast.success({
        title: t("saved_title"),
        message: t("saved_message"),
        duration: 3000,
      });
    } catch (err) {
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
      <div className="flex items-center gap-3 rounded-[var(--radius-card)] bg-white/45 p-3 shadow-[var(--shadow-card)]">
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
            <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-[var(--radius-card)] bg-[var(--color-main)] px-3 py-2 text-sm font-semibold text-white transition hover:brightness-105 focus-within:outline-none focus-within:ring-2 focus-within:ring-[var(--color-focus-ring)]">
              <ImagePlus size={17} aria-hidden />
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
                className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-card)] border border-black/10 bg-white px-3 py-2 text-sm font-semibold text-[var(--color-main)] transition hover:bg-black/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-60"
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
      <LockedEmailField label={t("email_label")} value={user.email} />
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

function LockedEmailField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span
        className="text-xs font-semibold"
        style={{
          color: "var(--color-secondary)",
          fontFamily: "var(--font-heading)",
        }}
      >
        {label}
      </span>
      <div className="flex min-h-11 min-w-0 items-center gap-3 rounded-[var(--radius-card)] border border-white bg-white/50 px-4 py-3 shadow-[var(--shadow-card)]">
        <LockKeyhole
          className="shrink-0 text-[var(--color-secondary)]"
          size={18}
          aria-hidden
        />
        <span className="min-w-0 flex-1 truncate text-base text-[var(--color-body)]">
          {value}
        </span>
      </div>
    </div>
  );
}
