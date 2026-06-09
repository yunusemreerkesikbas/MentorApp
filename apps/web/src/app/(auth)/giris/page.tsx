"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Field, FormError, SubmitButton } from "../../../components/form";
import { useAuth } from "../../../lib/auth-context";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const data = new FormData(e.currentTarget);
    try {
      await login({
        email: String(data.get("email")),
        password: String(data.get("password")),
      });
      router.push("/panel");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bir hata oluştu.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <h2 className="text-lg font-bold" style={{ color: "var(--color-main)" }}>
        Giriş yap
      </h2>
      <Field label="E-posta" name="email" type="email" autoComplete="email" required />
      <Field
        label="Şifre"
        name="password"
        type="password"
        autoComplete="current-password"
        required
      />
      <FormError message={error} />
      <SubmitButton busy={busy}>Giriş yap</SubmitButton>
      <div className="flex justify-between text-sm" style={{ color: "var(--color-secondary)" }}>
        <Link href="/kayit" className="underline">
          Hesap oluştur
        </Link>
        <Link href="/sifremi-unuttum" className="underline">
          Şifremi unuttum
        </Link>
      </div>
    </form>
  );
}
