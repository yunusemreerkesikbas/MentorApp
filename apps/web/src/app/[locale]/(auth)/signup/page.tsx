"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useState, type FormEvent } from "react";
import { SectionHeading } from "@mentor/ui";
import { Field, FormError, SubmitButton } from "@/components/form";
import { LegalLink } from "@/components/legal-link";
import { useAuth } from "@/lib/auth-context";
import { postAuthDestination, readAuthNextParam } from "@/lib/post-auth-destination";
import { useAnalyticsConsent } from "@/lib/analytics-consent";
import {
  applyAuthAnalyticsChoice,
  AUTH_ANALYTICS_FIELD,
  readAuthAnalyticsChecked,
} from "@/lib/auth-analytics-choice";
import { AuthCookieConsent } from "../_components/auth-cookie-consent";
import { AuthNavLink } from "../_components/auth-nav-link";
import { useAuthSheetExit } from "../_components/auth-shell";
import { GoogleAuthButton } from "../_components/google-auth-button";

export default function SignupPage() {
  const translate = useTranslations("auth.register");
  const ui = useTranslations("common");
  const { signup } = useAuth();
  const { accept, reject } = useAnalyticsConsent();
  const router = useRouter();
  const exitThen = useAuthSheetExit();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function requireKvkk() {
    const checked =
      document.querySelector<HTMLInputElement>('input[name="kvkk"]')?.checked === true;
    if (!checked) setError(translate("kvkk_error"));
    return checked;
  }

  function applyAnalyticsChoice() {
    applyAuthAnalyticsChoice(readAuthAnalyticsChecked(), { accept, reject });
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const data = new FormData(e.currentTarget);
    if (data.get("kvkk") !== "on") {
      setError(translate("kvkk_error"));
      setBusy(false);
      return;
    }
    applyAuthAnalyticsChoice(data.get(AUTH_ANALYTICS_FIELD) === "on", { accept, reject });
    try {
      const user = await signup({
        displayName: String(data.get("displayName")),
        email: String(data.get("email")),
        password: String(data.get("password")),
        kvkkAccepted: true,
      });
      exitThen(() => {
        // @ts-expect-error -- a validated internal path, transported as a plain string.
        router.push(postAuthDestination(user, readAuthNextParam()));
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <SectionHeading as="h2" className="items-center text-center">
        {translate("title")}
      </SectionHeading>
      <Field
        label={translate("name")}
        name="displayName"
        autoComplete="name"
        autoFocus
        required
        minLength={2}
      />
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
        autoComplete="new-password"
        required
        minLength={8}
        revealLabels={{ show: ui("show_password"), hide: ui("hide_password") }}
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
        {/* The checkbox asserts the notice was READ — so it has to be reachable from right here. */}
        <span>
          {translate.rich("kvkk", {
            link: (chunks) => <LegalLink slug="kvkk-aydinlatma">{chunks}</LegalLink>,
          })}
        </span>
      </label>
      <AuthCookieConsent />
      <FormError message={error} />
      <SubmitButton busy={busy}>{translate("submit")}</SubmitButton>
      <GoogleAuthButton
        mode="signup"
        onBeforeStart={() => {
          if (!requireKvkk()) return false;
          applyAnalyticsChoice();
          return true;
        }}
      />
      <p className="text-center text-sm" style={{ color: "var(--color-secondary)" }}>
        {translate("login_prompt")}{" "}
        <AuthNavLink href="/login">{translate("login_link")}</AuthNavLink>
      </p>
    </form>
  );
}
