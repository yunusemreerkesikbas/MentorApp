"use client";

import { useLocale } from "next-intl";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { accountSecurityLoginHref } from "./account-security";
import { useAuth } from "./auth-context";
import { getAuthSessionCoordinator } from "./auth-session-coordinator";

export function useAccountSecurity() {
  const locale = useLocale();
  const { logout } = useAuth();
  return async (reason: "reauth" | "emailchanged") => {
    const href = getPathname({ locale: locale as Locale, href: accountSecurityLoginHref(reason) });
    if (reason === "emailchanged") {
      // The successful email mutation already revoked every server session.
      getAuthSessionCoordinator().announce("logout");
      window.location.replace(href);
      return;
    }
    try {
      await logout();
    } catch {
      // Logout clears client state even on a network failure; a new login is still required.
    } finally {
      // Full navigation also discards pending forms and avoids the anonymous app guard race.
      window.location.replace(href);
    }
  };
}
