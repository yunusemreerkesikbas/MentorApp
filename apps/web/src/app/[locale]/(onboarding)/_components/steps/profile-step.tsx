"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { ApiClientError, usersControllerUpdateMe } from "@mentor/api-client";
import type { AuthUser } from "@mentor/types";
import { updateMeSchema, usernameSchema } from "@mentor/validation";
import { TextField } from "@mentor/ui";
import { FormError } from "@/components/form";
import { useAuth } from "@/lib/auth-context";
import { OnboardingStepLayout } from "../onboarding-step-layout";

const FORM_ID = "onboarding-username-form";

export function ProfileStep({ user, onBack, onSaved }: { user: AuthUser; onBack: () => void; onSaved: (user: AuthUser) => void }) {
  const t = useTranslations("onboarding.profile");
  const { setUserFromServer } = useAuth();
  const [username, setUsername] = useState(user.username ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const parsed = usernameSchema.safeParse(username);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!parsed.success || saving) return;
    if (user.username === parsed.data) { onSaved(user); return; }
    setSaving(true); setError(null); setUsernameError(null);
    try {
      const payload = updateMeSchema.parse({ username: parsed.data });
      const updated = (await usersControllerUpdateMe(payload)) as unknown as AuthUser;
      setUserFromServer(updated); onSaved(updated);
    } catch (err) {
      if (err instanceof ApiClientError && err.body.code === "AUTH_USERNAME_IN_USE") {
        setUsernameError(err.body.message);
        return;
      }
      setError(err instanceof ApiClientError ? err.body.message : t("save_error"));
    } finally { setSaving(false); }
  }

  return (
    <OnboardingStepLayout step={0} title={t("title")} onBack={onBack} primaryLabel={t("continue")} primaryFormId={FORM_ID} primaryBusy={saving} primaryDisabled={!parsed.success || saving}>
      <form id={FORM_ID} onSubmit={(event) => void submit(event)} className="mx-auto flex w-full max-w-xl flex-col gap-3">
        <FormError message={error} />
        <TextField label={t("username_label")} value={username} autoFocus required maxLength={24} disabled={saving} placeholder={t("username_placeholder")} error={usernameError} onChange={(event) => { setUsername(event.target.value); setError(null); setUsernameError(null); }} />
        <p className="text-xs leading-relaxed text-[var(--color-secondary)]">{t("username_hint")}</p>
      </form>
    </OnboardingStepLayout>
  );
}
