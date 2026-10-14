"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useState, useSyncExternalStore, type FormEvent } from "react";
import { SectionHeading } from "@mentor/ui";
import { Field, FormError, SubmitButton } from "@/components/form";
import { GoogleAuthFeedback } from "@/components/google-auth-feedback";
import { useAuth } from "@/lib/auth-context";
import { trackProductEvent } from "@/lib/analytics";
import { postAuthDestination, readAuthNextParam } from "@/lib/post-auth-destination";
import { loginSecurityReason } from "@/lib/account-security";
import { AuthNavLink } from "../_components/auth-nav-link";
import { useAuthSheetExit } from "../_components/auth-shell";
import { GoogleAuthButton } from "../_components/google-auth-button";
import { SignupTurnstile, turnstileSiteKey } from "../_components/signup-turnstile";

const subscribe = () => () => {};

export default function LoginPage() {
  const translate = useTranslations("auth.login");
  const ui = useTranslations("common");
  const { login } = useAuth();
  const router = useRouter();
  const exitThen = useAuthSheetExit();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);
  const reason = useSyncExternalStore(subscribe, () => loginSecurityReason(window.location.search), () => null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy || (turnstileSiteKey && !turnstileToken)) return;
    setError(null);
    setBusy(true);
    const data = new FormData(e.currentTarget);
    try {
      const user = await login({
        email: String(data.get("email")),
        password: String(data.get("password")),
        ...(turnstileToken ? { turnstileToken } : {}),
      });
      trackProductEvent("login", { method: "email" });
      const destination = postAuthDestination(user, readAuthNextParam());
      // Fetched while the sheet leaves, so the handover has nothing left to wait for.
      // @ts-expect-error -- a validated internal path, transported as a plain string.
      router.prefetch(destination);
      exitThen(() => {
        // @ts-expect-error -- a validated internal path, transported as a plain string.
        router.push(destination);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    } finally {
      setTurnstileToken(null);
      setTurnstileResetKey((value) => value + 1);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <SectionHeading as="h2" className="items-center text-center">
        {translate("title")}
      </SectionHeading>
      {reason ? <p role="status" className="text-sm text-[var(--color-secondary)]">{translate(reason)}</p> : null}
      <Field
        label={translate("email")}
        name="email"
        type="email"
        autoComplete="email"
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
      <GoogleAuthFeedback />
      <SignupTurnstile action="login" onToken={setTurnstileToken} resetKey={turnstileResetKey} />
      <SubmitButton busy={busy} disabled={Boolean(turnstileSiteKey && !turnstileToken)}>{translate("submit")}</SubmitButton>
      <GoogleAuthButton mode="login" />
      <p className="text-center text-sm" style={{ color: "var(--color-secondary)" }}>
        {translate("register_prompt")}{" "}
        <AuthNavLink href="/signup">{translate("register_link")}</AuthNavLink>
      </p>
    </form>
  );
}
