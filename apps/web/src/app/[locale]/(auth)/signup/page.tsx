"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useId, useState, useSyncExternalStore, type FormEvent } from "react";
import { CheckBox, SectionHeading } from "@mentor/ui";
import { Field, FormError, SubmitButton } from "@/components/form";
import { LegalLink } from "@/components/legal-link";
import { useAuth } from "@/lib/auth-context";
import { trackProductEvent } from "@/lib/analytics";
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
import { SignupTurnstile, turnstileSiteKey } from "../_components/signup-turnstile";

/** Hoisted so the subscribe reference is stable across renders. */
const NEVER_CHANGES = () => () => {};

/**
 * Reads the coach entry point off the URL (APP-089).
 *
 * `?rol=koc` in both locales rather than a localized param, because the link is written by us and a
 * marketing page pointing at `/kayit?rol=koc` should keep working from anywhere. Anything else,
 * including a missing value, is a student — the enum on the API is what actually decides.
 */
function useCoachIntent(): boolean {
  return useSyncExternalStore(
    // The value cannot change without a navigation, which remounts this page anyway.
    NEVER_CHANGES,
    () => new URLSearchParams(window.location.search).get("rol") === "koc",
    // Server snapshot. The page is statically rendered, so the query string is unknown at build
    // time and the first paint is always the student form; the coach heading arrives on hydration.
    // `useSearchParams` would read it during render but drags the whole page into a Suspense
    // boundary, which is the same reason `readAuthNextParam` reads `window` by hand.
    () => false,
  );
}

export default function SignupPage() {
  const translate = useTranslations("auth.register");
  const ui = useTranslations("common");
  const { signup } = useAuth();
  const isCoach = useCoachIntent();
  const { accept, reject } = useAnalyticsConsent();
  const router = useRouter();
  const exitThen = useAuthSheetExit();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [kvkkChecked, setKvkkChecked] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);
  const kvkkLabelId = useId();

  function requireKvkk() {
    if (!kvkkChecked) setError(translate("kvkk_error"));
    return kvkkChecked;
  }

  function applyAnalyticsChoice() {
    applyAuthAnalyticsChoice(readAuthAnalyticsChecked(), { accept, reject });
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (turnstileSiteKey && !turnstileToken) return;
    setError(null);
    setBusy(true);
    const data = new FormData(e.currentTarget);
    if (!kvkkChecked || data.get("kvkk") !== "on") {
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
        ...(turnstileToken ? { turnstileToken } : {}),
        // Grants COACH, which shapes the onboarding and the home surface. It authorizes nothing on
        // its own: the invite code needs a verified email and a registry row this account does not
        // have yet. See `signupSchema.intent`.
        ...(isCoach ? { intent: "COACH" as const } : {}),
      });
      trackProductEvent("sign_up", { method: "email", intent: isCoach ? "coach" : "student" });
      exitThen(() => {
        // @ts-expect-error -- a validated internal path, transported as a plain string.
        router.push(postAuthDestination(user, readAuthNextParam()));
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
      setTurnstileToken(null);
      setTurnstileResetKey((value) => value + 1);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <SectionHeading as="h2" className="items-center text-center">
        {isCoach ? translate("title_coach") : translate("title")}
      </SectionHeading>
      {isCoach && (
        <p className="text-center text-sm" style={{ color: "var(--color-secondary)" }}>
          {translate("coach_intro")}
        </p>
      )}
      <Field
        label={translate("name")}
        name="displayName"
        autoComplete="name"
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
      <div
        className="flex min-h-11 items-start gap-3 text-sm"
        style={{ color: "var(--color-body)" }}
      >
        <CheckBox
          checked={kvkkChecked}
          onChange={setKvkkChecked}
          name="kvkk"
          value="on"
          required
          aria-labelledby={kvkkLabelId}
          className="mt-1"
        />
        {/* The checkbox asserts the notice was READ — so it has to be reachable from right here. */}
        <span id={kvkkLabelId}>
          {translate.rich("kvkk", {
            link: (chunks) => <LegalLink slug="kvkk-aydinlatma">{chunks}</LegalLink>,
          })}
        </span>
      </div>
      <AuthCookieConsent />
      <SignupTurnstile onToken={setTurnstileToken} resetKey={turnstileResetKey} />
      <FormError message={error} />
      <SubmitButton busy={busy} disabled={Boolean(turnstileSiteKey && !turnstileToken)}>{translate("submit")}</SubmitButton>
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
      {/* Quiet, and below the fold of the form on purpose. Registration is open to anyone who wants
          it, but a loud second button would invite every new student to wonder if they should be a
          coach — the intake is self-service, not something to upsell. */}
      {!isCoach && (
        <p className="text-center text-sm" style={{ color: "var(--color-secondary)" }}>
          {/* Object form, not a string: `@/i18n/navigation` types hrefs against the route map, so
              the query has to travel beside the pathname rather than glued onto it. */}
          <AuthNavLink href={{ pathname: "/signup", query: { rol: "koc" } }}>
            {translate("coach_link")}
          </AuthNavLink>
        </p>
      )}
    </form>
  );
}
