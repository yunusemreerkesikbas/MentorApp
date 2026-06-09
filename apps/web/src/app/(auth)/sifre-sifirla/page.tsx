"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { authControllerResetPassword } from "@mentor/api-client";
import { Field, FormError, FormSuccess, SubmitButton } from "../../../components/form";

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
      <h2 className="text-lg font-bold" style={{ color: "var(--color-main)" }}>
        Yeni şifre belirle
      </h2>
      {done ? (
        <>
          <FormSuccess message="Şifren güncellendi. Artık yeni şifrenle giriş yapabilirsin." />
          <Link href="/giris" className="text-sm underline" style={{ color: "var(--color-secondary)" }}>
            Girişe dön
          </Link>
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
