"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useState, type FormEvent } from "react";
import { SectionHeading } from "@mentor/ui";
import { Field, FormError, SubmitButton } from "@/components/form";
import { useAuth } from "@/lib/auth-context";
import { postAuthDestination } from "@/lib/post-auth-destination";
import { AuthNavLink } from "../_components/auth-nav-link";
import { GoogleAuthButton } from "../_components/google-auth-button";

export default function LoginPage() {
  const translate = useTranslations("auth.login");
  const ui = useTranslations("common");
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
      const user = await login({
        email: String(data.get("email")),
        password: String(data.get("password")),
      });
      router.push(postAuthDestination(user));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <SectionHeading as="h2" className="justify-center text-center">
        {translate("title")}
      </SectionHeading>
      <Field
        label={translate("email")}
        name="email"
        type="email"
        autoComplete="email"
        autoFocus
        required
      />
      <Field
        label={translate("password")}
        name="password"
        type="password"
        autoComplete="current-password"
        required
        revealLabels={{ show: ui("show_password"), hide: ui("hide_password") }}
      />
      <div className="flex justify-end">
        <AuthNavLink href="/forgot-password">{translate("forgot_link")}</AuthNavLink>
      </div>
      <FormError message={error} />
      <SubmitButton busy={busy}>{translate("submit")}</SubmitButton>
      <GoogleAuthButton mode="login" />
      <p className="text-center text-sm" style={{ color: "var(--color-secondary)" }}>
        {translate("register_prompt")}{" "}
        <AuthNavLink href="/signup">{translate("register_link")}</AuthNavLink>
      </p>
    </form>
  );
}
