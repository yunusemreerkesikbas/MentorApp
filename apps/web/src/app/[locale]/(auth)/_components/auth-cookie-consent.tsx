"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { AUTH_ANALYTICS_FIELD } from "@/lib/auth-analytics-choice";
import { useAnalyticsConsent } from "@/lib/analytics-consent";

/** Optional analytics cookie opt-in for login/signup. Banner stays on public pages only. */
export function AuthCookieConsent() {
  const t = useTranslations("auth.cookie");
  const { consent } = useAnalyticsConsent();
  const [userChoice, setUserChoice] = useState<boolean | null>(null);
  const checked = userChoice ?? consent === "accepted";

  return (
    <label
      className="flex min-h-11 cursor-pointer items-start gap-3 text-sm"
      style={{ color: "var(--color-body)" }}
    >
      <input
        type="checkbox"
        name={AUTH_ANALYTICS_FIELD}
        checked={checked}
        onChange={(event) => setUserChoice(event.target.checked)}
        className="mt-1 h-5 w-5 shrink-0"
      />
      <span>
        {t.rich("label", {
          link: (chunks) => (
            <Link
              href="/cookie-preferences"
              target="_blank"
              onClick={(event) => event.stopPropagation()}
              className="underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2"
              style={{ color: "var(--color-accent)" }}
            >
              {chunks}
            </Link>
          ),
        })}
      </span>
    </label>
  );
}
