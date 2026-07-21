"use client";

import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { authControllerResetPassword } from "@mentor/api-client";
import { SectionHeading } from "@mentor/ui";
import { Field, FormError, FormSuccess, SubmitButton } from "@/components/form";
import { AuthNavLink } from "../_components/auth-nav-link";

function ResetPasswordForm() {
  const t = useTranslations("auth.reset_password");
  const token = useSearchParams().get("token") ?? "";
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const data = new FormData(e.currentTarget);
    try {
      await authControllerResetPassword({
        token,
        password: String(data.get("password")),
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  if (!token) {
    return <FormError message={t("invalid_link")} />;
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <SectionHeading as="h2">{t("title")}</SectionHeading>
      {done ? (
        <>
          <FormSuccess message={t("success")} />
          <AuthNavLink href="/login">{t("back_login")}</AuthNavLink>
        </>
      ) : (
        <>
          <Field
            label={t("password")}
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
          />
          <FormError message={error} />
          <SubmitButton busy={busy}>{t("submit")}</SubmitButton>
        </>
      )}
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
