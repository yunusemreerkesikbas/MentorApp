"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  googleLinkingControllerStart,
  googleLinkingControllerStatus,
} from "@mentor/api-client";
import type { GoogleLinkStartResponse, GoogleLinkStatus } from "@mentor/types";
import { googleLinkStartSchema } from "@mentor/validation";
import { Button, Card, Skeleton } from "@mentor/ui";
import { Field, FormError } from "@/components/form";
import { GoogleAuthFeedback } from "@/components/google-auth-feedback";

type LoadState = { status: "loading" } | { status: "error"; message: string } |
  { status: "ready"; value: GoogleLinkStatus };

export function GoogleAccountCard() {
  const t = useTranslations("profile.google_account");
  const common = useTranslations("common");
  const locale = useLocale();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (googleLinkingControllerStatus() as unknown as Promise<GoogleLinkStatus>).then((result) => {
      if (active) setState({ status: "ready", value: result });
    }).catch((err: unknown) => {
      if (active) setState({ status: "error", message: err instanceof Error ? err.message : String(err) });
    });
    return () => { active = false; };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const input = googleLinkStartSchema.safeParse({ password: new FormData(form).get("password"), locale });
    if (!input.success) { setError(t("password_required")); return; }
    setBusy(true);
    setError(null);
    try {
      const result = await googleLinkingControllerStart(input.data) as unknown as GoogleLinkStartResponse;
      form.reset();
      window.location.assign(result.url);
    } catch (err) {
      form.reset();
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  if (state.status === "ready" && !state.value.enabled && !state.value.linked) return null;

  return (
    <Card>
      <h2 className="text-lg font-semibold">{t("title")}</h2>
      <div className="mt-4 flex flex-col gap-4">
        <GoogleAuthFeedback />
        {state.status === "loading" ? (
          <div role="status" aria-label={t("loading")} className="flex flex-col gap-3">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : state.status === "error" ? <FormError message={state.message} /> : state.value.linked ? (
          <p role="status" className="text-sm text-[var(--color-secondary)]">
            {t("linked", { email: state.value.providerEmail ?? "" })}
          </p>
        ) : state.value.canLink ? (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <p className="text-sm text-[var(--color-secondary)]">{t("description")}</p>
            <Field label={t("password")} name="password" type="password" autoComplete="current-password"
              required maxLength={128} disabled={busy}
              revealLabels={{ show: common("show_password"), hide: common("hide_password") }} />
            <FormError message={error} />
            <Button type="submit" busy={busy}>{t("connect")}</Button>
          </form>
        ) : <p className="text-sm text-[var(--color-secondary)]">{t("verify_first")}</p>}
      </div>
    </Card>
  );
}
