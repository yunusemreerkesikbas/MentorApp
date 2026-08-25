"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { apiBaseUrl } from "@/lib/api-base";
import { fetchGoogleAuthEnabled } from "@/lib/google-auth";
import { useAuthSheetExit } from "./auth-shell";

interface GoogleAuthButtonProps {
  mode: "login" | "signup";
  onBeforeStart?: () => boolean;
}

const dividerStyle = {
  backgroundColor: "color-mix(in srgb, var(--color-main) 12%, transparent)",
};

function GoogleLogo() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5">
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

export function GoogleAuthButton({ mode, onBeforeStart }: GoogleAuthButtonProps) {
  const locale = useLocale();
  const t = useTranslations("auth.google");
  const exitThen = useAuthSheetExit();
  const [enabled, setEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    fetchGoogleAuthEnabled()
      .then((nextEnabled) => {
        if (active) setEnabled(nextEnabled);
      })
      .catch(() => {
        if (active) setEnabled(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (enabled === false) return null;

  const pending = enabled !== true;

  function handleClick() {
    if (onBeforeStart && !onBeforeStart()) return;
    const params = new URLSearchParams({
      mode,
      locale,
      returnTo: getPathname({
        locale: locale as Locale,
        href: "/dashboard",
      }),
    });
    if (mode === "signup") params.set("kvkkAccepted", "true");
    const href = `${apiBaseUrl()}/v1/auth/google/start?${params.toString()}`;
    exitThen(() => {
      window.location.assign(href);
    });
  }

  return (
    <div className="flex flex-col gap-3" aria-hidden={pending || undefined}>
      <div className="flex items-center gap-3" aria-hidden>
        <span className="h-px flex-1" style={dividerStyle} />
        <span className="text-xs" style={{ color: "var(--color-secondary)" }}>
          {t("or")}
        </span>
        <span className="h-px flex-1" style={dividerStyle} />
      </div>
      <button
        type="button"
        aria-label={t("continue")}
        onClick={handleClick}
        disabled={pending}
        className={`mx-auto flex h-12 w-12 cursor-pointer items-center justify-center rounded-full border bg-[var(--color-surface)] transition-colors hover:bg-[color-mix(in_srgb,var(--color-main)_5%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface)] motion-reduce:transition-none ${pending ? "invisible" : ""}`}
        style={{
          borderColor: "color-mix(in srgb, var(--color-main) 15%, transparent)",
        }}
      >
        <GoogleLogo />
      </button>
    </div>
  );
}
