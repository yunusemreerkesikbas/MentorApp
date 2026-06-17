"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { authControllerResetPassword } from "@mentor/api-client";
import { SectionHeading } from "@mentor/ui";
import { Field, FormError, FormSuccess, SubmitButton } from "../../../components/form";
import { AuthNavLink } from "../_components/auth-nav-link";

function ResetPasswordForm() {
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
      await authControllerResetPassword({ token, password: String(data.get("password")) });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bir hata oluştu.");
    } finally {
      setBusy(false);
    }
  }

  if (!token) {
    return <FormError message="Geçersiz bağlantı. Lütfen e-postandaki bağlantıyı kullan." />;
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <SectionHeading as="h2">Yeni şifre belirle</SectionHeading>
      {done ? (
        <>
          <FormSuccess message="Şifren güncellendi. Artık yeni şifrenle giriş yapabilirsin." />
          <AuthNavLink href="/giris">Girişe dön</AuthNavLink>
        </>
      ) : (
        <>
          <Field
            label="Yeni şifre (en az 8 karakter, harf + rakam)"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
          />
          <FormError message={error} />
          <SubmitButton busy={busy}>Şifreyi güncelle</SubmitButton>
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
