"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { SectionHeading } from "@mentor/ui";
import { Field, FormError, SubmitButton } from "../../../components/form";
import { useAuth } from "../../../lib/auth-context";
import { AuthNavLink } from "../_components/auth-nav-link";

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
      <SectionHeading as="h2" subtitle="Devam etmek için giriş yap.">
        Giriş yap
      </SectionHeading>
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
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
        <AuthNavLink href="/kayit">Hesap oluştur</AuthNavLink>
        <AuthNavLink href="/sifremi-unuttum">Şifremi unuttum</AuthNavLink>
      </div>
    </form>
  );
}
