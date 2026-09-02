"use client";

import { ImagePlus, Trash2 } from "lucide-react";
import { useEffect, useState, type ChangeEvent } from "react";
import { useTranslations } from "next-intl";
import { ApiClientError, usersControllerUpdateMe } from "@mentor/api-client";
import type { AuthUser } from "@mentor/types";
import { updateMeSchema } from "@mentor/validation";
import { FormError } from "@/components/form";
import { UserAvatar } from "@/components/user-avatar";
import { createAvatarUploadUrl, putAvatarToSignedUrl, resolveAvatarUrl } from "@/lib/avatar";
import { useAuth } from "@/lib/auth-context";
import { OnboardingStepLayout } from "../onboarding-step-layout";

const MAX_BYTES = 2 * 1024 * 1024;
const TYPES = new Set(["image/jpeg", "image/png"]);

export function AvatarStep({ user, onBack, onSaved, onSkip }: { user: AuthUser; onBack: () => void; onSaved: (user: AuthUser) => void; onSkip: () => void }) {
  const t = useTranslations("onboarding.profile");
  const { setUserFromServer } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [remove, setRemove] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  function choose(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.files?.[0]; event.target.value = "";
    if (!next) return;
    if (!TYPES.has(next.type)) { setError(t("avatar_type_error")); return; }
    if (next.size > MAX_BYTES) { setError(t("avatar_too_big")); return; }
    setFile(next); setPreview(URL.createObjectURL(next)); setRemove(false); setError(null);
  }

  async function save() {
    if (saving) return;
    if (!file && !remove) { onSaved(user); return; }
    setSaving(true); setError(null);
    try {
      let avatarStorageKey: string | null = null;
      if (file) {
        const contentType = file.type as "image/jpeg" | "image/png";
        const upload = await createAvatarUploadUrl(contentType);
        if (file.size > upload.maxBytes) throw new Error(t("avatar_too_big"));
        await putAvatarToSignedUrl(upload.uploadUrl, file, contentType);
        avatarStorageKey = upload.key;
      }
      const updated = (await usersControllerUpdateMe(updateMeSchema.parse({ avatarStorageKey }))) as unknown as AuthUser;
      setUserFromServer(updated); onSaved(updated);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.body.message : err instanceof Error ? err.message : t("avatar_upload_error"));
    } finally { setSaving(false); }
  }

  return (
    <OnboardingStepLayout step={1} title={t("avatar_title")} onBack={onBack} skipLabel={t("skip")} onSkip={onSkip} primaryLabel={t("continue")} onPrimary={() => void save()} primaryBusy={saving}>
      <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-5 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
        <FormError message={error} />
        <UserAvatar frame="strong" name={user.displayName} size={112} src={remove ? null : preview ?? resolveAvatarUrl(user.avatarUrl)} />
        <div className="flex flex-wrap justify-center gap-2">
          <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-[var(--radius-card)] border border-[var(--color-border)] px-4 py-2 font-semibold text-[var(--color-main)] focus-within:ring-2"><ImagePlus size={18} aria-hidden />{t("avatar_change")}<input className="sr-only" type="file" accept="image/jpeg,image/png" disabled={saving} onChange={choose} /></label>
          {(user.avatarUrl || preview) && !remove ? <button type="button" onClick={() => { setFile(null); setPreview(null); setRemove(true); }} className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-card)] px-4 py-2 font-semibold text-[var(--color-secondary)] focus-visible:ring-2"><Trash2 size={18} aria-hidden />{t("avatar_remove")}</button> : null}
        </div>
      </div>
    </OnboardingStepLayout>
  );
}
