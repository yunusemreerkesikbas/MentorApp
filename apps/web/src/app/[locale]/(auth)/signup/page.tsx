"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useState, type FormEvent } from "react";
import { SectionHeading } from "@mentor/ui";
import { coachingControllerUpsertVision } from "@mentor/api-client";
import { Field, FormError, SubmitButton } from "@/components/form";
import { LegalLink } from "@/components/legal-link";
import { useAuth } from "@/lib/auth-context";
import { postAuthDestination } from "@/lib/post-auth-destination";
import { AuthNavLink } from "../_components/auth-nav-link";
import { GoogleAuthButton } from "../_components/google-auth-button";

export default function SignupPage() {
  const translate = useTranslations("auth.register");
  const ui = useTranslations("common");
  const { signup } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function requireKvkk() {
    const checked =
      document.querySelector<HTMLInputElement>('input[name="kvkk"]')?.checked === true;
    if (!checked) setError(translate("kvkk_error"));
    return checked;
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
    try {
      const user = await signup({
        displayName: String(data.get("displayName")),
        username: String(data.get("username")),
        email: String(data.get("email")),
        password: String(data.get("password")),
        kvkkAccepted: true,
      });
      const goalTitle = String(data.get("goalTitle") ?? "").trim();
      if (goalTitle) {
        await coachingControllerUpsertVision({
          goalTitle,
          targetCity: null,
          motivation: null,
        }).catch(() => undefined);
      }
      router.push(postAuthDestination(user));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <SectionHeading as="h2" subtitle={translate("subtitle")} className="justify-center text-center">
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
        label={translate("username")}
        name="username"
        autoComplete="username"
        required
        minLength={3}
        maxLength={24}
        placeholder={translate("username_placeholder")}
      />
      <p className="-mt-3 text-xs leading-relaxed text-[var(--color-secondary)]">
        {translate("username_hint")}
      </p>
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
      <Field
        label={translate("goal")}
        name="goalTitle"
        maxLength={120}
        placeholder={translate("goal_placeholder")}
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
      <FormError message={error} />
      <SubmitButton busy={busy}>{translate("submit")}</SubmitButton>
      <GoogleAuthButton mode="signup" onBeforeStart={requireKvkk} />
      <p className="text-center text-sm" style={{ color: "var(--color-secondary)" }}>
        {translate("login_prompt")}{" "}
        <AuthNavLink href="/login">{translate("login_link")}</AuthNavLink>
      </p>
    </form>
  );
}
