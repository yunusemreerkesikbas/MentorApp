"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useState, type FormEvent } from "react";
import { SectionHeading } from "@mentor/ui";
import { Field, FormError, SubmitButton } from "@/components/form";
import { useAuth } from "@/lib/auth-context";
import { AuthNavLink } from "../_components/auth-nav-link";

export default function SignupPage() {
  const t = useTranslations("auth.register");
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
      setError(t("kvkk_error"));
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
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <SectionHeading as="h2" subtitle={t("subtitle")}>
        {t("title")}
      </SectionHeading>
      <Field
        label={t("name")}
        name="displayName"
        autoComplete="name"
        required
        minLength={2}
      />
      <Field
        label={t("email")}
        name="email"
        type="email"
        autoComplete="email"
        required
      />
      <Field
        label={t("password")}
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
        <input
          type="checkbox"
          name="kvkk"
          required
          className="mt-1 h-5 w-5 shrink-0"
        />
        <span>{t("kvkk")}</span>
      </label>
      <FormError message={error} />
      <SubmitButton busy={busy}>{t("submit")}</SubmitButton>
      <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
        {t("login_prompt")}{" "}
        <AuthNavLink href="/giris">{t("login_link")}</AuthNavLink>
      </p>
    </form>
  );
}
