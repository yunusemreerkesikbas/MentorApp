"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { authControllerForgotPassword } from "@mentor/api-client";
import { Field, FormError, FormSuccess, SubmitButton } from "../../../components/form";

export default function ForgotPasswordPage() {
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const data = new FormData(e.currentTarget);
    try {
      await authControllerForgotPassword({ email: String(data.get("email")) });
      setDone(true); // backend always returns 200 (no enumeration)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bir hata oluştu.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <h2 className="text-lg font-bold" style={{ color: "var(--color-main)" }}>
        Şifremi unuttum
      </h2>
      {done ? (
        <FormSuccess message="Bu e-posta kayıtlıysa, şifre sıfırlama bağlantısı gönderildi. Gelen kutunu kontrol et." />
      ) : (
        <>
          <Field label="E-posta" name="email" type="email" autoComplete="email" required />
          <FormError message={error} />
          <SubmitButton busy={busy}>Sıfırlama bağlantısı gönder</SubmitButton>
        </>
      )}
      <Link href="/giris" className="text-sm underline" style={{ color: "var(--color-secondary)" }}>
        Girişe dön
      </Link>
    </form>
  );
}
