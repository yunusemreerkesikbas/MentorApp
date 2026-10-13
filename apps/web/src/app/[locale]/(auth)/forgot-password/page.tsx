"use client";

import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { authControllerForgotPassword } from "@mentor/api-client";
import { SectionHeading } from "@mentor/ui";
import { Field, FormError, FormSuccess, SubmitButton } from "@/components/form";
import { SignupTurnstile, turnstileSiteKey } from "../_components/signup-turnstile";

export default function ForgotPasswordPage() {
  const t = useTranslations("auth.forgot_password");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy || (turnstileSiteKey && !turnstileToken)) return;
    setError(null);
    setBusy(true);
    const data = new FormData(e.currentTarget);
    try {
      await authControllerForgotPassword({ email: String(data.get("email")), ...(turnstileToken ? { turnstileToken } : {}) });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
      setTurnstileToken(null);
      setTurnstileResetKey((value) => value + 1);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <SectionHeading as="h2" subtitle={t("subtitle")}>
        {t("title")}
      </SectionHeading>
      {done ? (
        <FormSuccess message={t("success")} />
      ) : (
        <>
          <Field
            label={t("email")}
            name="email"
            type="email"
            autoComplete="email"
            required
          />
          <FormError message={error} />
          <SignupTurnstile action="forgot-password" onToken={setTurnstileToken} resetKey={turnstileResetKey} />
          <SubmitButton busy={busy} disabled={Boolean(turnstileSiteKey && !turnstileToken)}>{t("submit")}</SubmitButton>
        </>
      )}
    </form>
  );
}
