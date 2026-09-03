"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { CheckBox } from "@mentor/ui";
import { Link } from "@/i18n/navigation";
import { AUTH_ANALYTICS_FIELD } from "@/lib/auth-analytics-choice";
import { useAnalyticsConsent } from "@/lib/analytics-consent";

/** Optional analytics cookie opt-in for login/signup. Banner stays on public pages only. */
export function AuthCookieConsent() {
  const t = useTranslations("auth.cookie");
  const { consent } = useAnalyticsConsent();
  const [userChoice, setUserChoice] = useState<boolean | null>(null);
  const checked = userChoice ?? consent === "accepted";
  const labelId = useId();

  return (
    <div className="flex min-h-11 items-start gap-3 text-sm" style={{ color: "var(--color-body)" }}>
      <CheckBox
        checked={checked}
        onChange={setUserChoice}
        name={AUTH_ANALYTICS_FIELD}
        value="on"
        aria-labelledby={labelId}
        className="mt-1"
      />
      <span id={labelId}>
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
    </div>
  );
}
