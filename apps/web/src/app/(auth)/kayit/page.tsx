"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { SectionHeading } from "@mentor/ui";
import { Field, FormError, SubmitButton } from "../../../components/form";
import { useAuth } from "../../../lib/auth-context";
import { AuthNavLink } from "../_components/auth-nav-link";

export default function SignupPage() {
  const { signup } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const data = new FormData(e.currentTarget);
    if (data.get("kvkk") !== "on") {
      setError("Devam etmek için KVKK metnini kabul etmelisin.");
      setBusy(false);
      return;
    }
    try {
      await signup({
        displayName: String(data.get("displayName")),
        email: String(data.get("email")),
        password: String(data.get("password")),
        kvkkAccepted: true,
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
      <SectionHeading as="h2" subtitle="Ücretsiz başla — sınav yolunda yanında olalım.">
        Hesap oluştur
      </SectionHeading>
      <Field label="Ad Soyad" name="displayName" autoComplete="name" required minLength={2} />
      <Field label="E-posta" name="email" type="email" autoComplete="email" required />
      <Field
        label="Şifre (en az 8 karakter, harf + rakam)"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
      />
      <label
        className="flex min-h-11 cursor-pointer items-start gap-3 text-sm"
        style={{ color: "var(--color-body)" }}
      >
        <input type="checkbox" name="kvkk" required className="mt-1 h-5 w-5 shrink-0" />
        <span>
          KVKK aydınlatma metnini okudum, kişisel verilerimin işlenmesini kabul ediyorum.
        </span>
      </label>
      <FormError message={error} />
      <SubmitButton busy={busy}>Kayıt ol</SubmitButton>
      <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
        Zaten hesabın var mı? <AuthNavLink href="/giris">Giriş yap</AuthNavLink>
      </p>
    </form>
  );
}
