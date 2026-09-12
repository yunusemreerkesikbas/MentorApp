"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { BadgeCheck } from "lucide-react";
import {
  googleLinkingControllerStart,
  googleLinkingControllerStatus,
} from "@mentor/api-client";
import type { GoogleLinkStartResponse, GoogleLinkStatus } from "@mentor/types";
import { googleLinkStartSchema } from "@mentor/validation";
import { Button, Card, Skeleton } from "@mentor/ui";
import { Field, FormError } from "@/components/form";
import { GoogleAuthFeedback } from "@/components/google-auth-feedback";
import { useMentorBottomSheet } from "@/lib/mentor-bottom-sheet";
import { ListRow } from "./account-links-card";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; value: GoogleLinkStatus };

function GoogleLogo() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-4.5">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1A6.6 6.6 0 0 1 5.48 12c0-.73.13-1.43.36-2.1V7.06H2.18A10.94 10.94 0 0 0 1 12c0 1.77.42 3.45 1.18 4.94l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06L5.84 9.9C6.71 7.31 9.14 5.38 12 5.38z"
      />
    </svg>
  );
}

export function GoogleAccountCard() {
  const t = useTranslations("profile.google_account");
  const locale = useLocale();
  const sheet = useMentorBottomSheet();
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let active = true;
    (googleLinkingControllerStatus() as unknown as Promise<GoogleLinkStatus>)
      .then((result) => {
        if (active) setState({ status: "ready", value: result });
      })
      .catch((err: unknown) => {
        if (active)
          setState({
            status: "error",
            message: err instanceof Error ? err.message : String(err),
          });
      });
    return () => {
      active = false;
    };
  }, []);

  const openModal = useCallback(() => {
    if (state.status !== "ready") return;
    sheet.show({
      title: t("title"),
      layout: "filter",
      dismissOnBackdrop: false,
      children: (
        <GoogleAccountModalContent
          state={state.value}
          locale={locale}
          onCancel={sheet.dismiss}
        />
      ),
    });
  }, [locale, sheet, state, t]);

  if (state.status === "ready" && !state.value.enabled && !state.value.linked) {
    return null;
  }

  if (state.status === "loading") {
    return (
      <Card solid className="p-2 sm:p-2.5">
        <div className="px-2 pt-1 pb-1.5">
          <Skeleton className="h-4 w-28 rounded-[var(--radius-card)]" />
        </div>
        <div className="flex flex-col gap-0.5">
          <div className="flex min-h-11 w-full items-center gap-3 px-3 py-1.5">
            <Skeleton className="size-7 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1">
              <Skeleton className="h-4 w-32 rounded-[var(--radius-card)]" />
              <Skeleton className="mt-1 h-3 w-44 rounded-[var(--radius-card)]" />
            </div>
          </div>
        </div>
      </Card>
    );
  }

  const description =
    state.status === "error"
      ? state.message
      : state.value.linked
        ? (state.value.providerEmail ?? t("linked", { email: "" }))
        : state.value.canLink
          ? t("connect")
          : t("verify_first");

  return (
    <Card solid className="p-2 sm:p-2.5">
      <div className="px-2 pt-1 pb-1.5">
        <h2
          className="text-xs font-semibold uppercase tracking-wider text-[var(--color-secondary)]"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          {t("title")}
        </h2>
      </div>
      <div className="flex flex-col gap-0.5">
        <GoogleAuthFeedback />
        <ListRow
          icon={<GoogleLogo />}
          description={description}
          onClick={openModal}
        >
          {t("title")}
        </ListRow>
      </div>
    </Card>
  );
}

function GoogleAccountModalContent({
  state,
  locale,
  onCancel,
}: {
  state: GoogleLinkStatus;
  locale: string;
  onCancel: () => void;
}) {
  const t = useTranslations("profile.google_account");
  const common = useTranslations("common");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const input = googleLinkStartSchema.safeParse({
      password: new FormData(form).get("password"),
      locale,
    });
    if (!input.success) {
      setError(t("password_required"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = (await googleLinkingControllerStart(
        input.data,
      )) as unknown as GoogleLinkStartResponse;
      form.reset();
      window.location.assign(result.url);
    } catch (err) {
      form.reset();
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 py-1">
      <GoogleAuthFeedback />
      {state.linked ? (
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <span className="grid size-12 place-items-center rounded-full bg-[color-mix(in_srgb,var(--color-success)_15%,transparent)] text-[var(--color-success)]">
            <BadgeCheck size={24} aria-hidden />
          </span>
          <div>
            <h3 className="text-base font-semibold text-[var(--color-main)]">
              {t("title")}
            </h3>
            <p className="mt-1 text-sm text-[var(--color-secondary)]">
              {t("linked", { email: state.providerEmail ?? "" })}
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={onCancel}
            className="mt-2"
          >
            {t("close")}
          </Button>
        </div>
      ) : state.canLink ? (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <p className="text-sm text-[var(--color-secondary)]">
            {t("description")}
          </p>
          <div className="flex flex-col gap-1.5">
            <Field
              label={t("password")}
              name="password"
              type="password"
              autoComplete="current-password"
              required
              maxLength={128}
              disabled={busy}
              autoFocus
              revealLabels={{
                show: common("show_password"),
                hide: common("hide_password"),
              }}
            />
            <p className="text-xs text-[var(--color-secondary)]">
              {t("password_hint")}
            </p>
          </div>
          {error ? <FormError message={error} /> : null}
          <div className="flex items-center gap-2.5 pt-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onCancel}
              disabled={busy}
              className="shrink-0 whitespace-nowrap"
            >
              {t("cancel")}
            </Button>
            <Button
              type="submit"
              size="sm"
              busy={busy}
              className="flex-1 whitespace-nowrap"
            >
              {t("connect")}
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <p className="text-sm text-[var(--color-secondary)]">
            {t("verify_first")}
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={onCancel}
            className="mt-2"
          >
            {t("close")}
          </Button>
        </div>
      )}
    </div>
  );
}
