"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { useAppAvailability } from "@/lib/app-availability";
import { blockedAppFeature } from "@/lib/app-feature-routes";
import { useAuth } from "@/lib/auth-context";
import { isCoach } from "@/lib/coach-surface";

/** Above route-specific providers, so a closed route never mounts its data-fetching client. */
export function AppFeatureBoundary({ children }: { children: ReactNode }) {
  const availability = useAppAvailability();
  const { user, status } = useAuth();
  // Read the actual address: next-intl's navigation hook can return /member/[username].
  const pathname = usePathname();
  const t = useTranslations("availability");
  const memberPath = /\/(?:community\/member|topluluk\/uye)\//.test(pathname);
  if (status === "loading" && memberPath && !availability?.social) {
    return <main aria-busy="true" className="flex min-h-dvh items-center justify-center p-6"><p role="status">{t("loading")}</p></main>;
  }
  if (!blockedAppFeature(pathname, user, availability)) return children;
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[var(--color-bg)] p-6 text-[var(--color-main)]">
      <div className="max-w-lg space-y-5">
        <h1 className="text-2xl font-extrabold">{t(availability ? "closed_title" : "unavailable_title")}</h1>
        <p className="text-[var(--color-secondary)]">{t(availability ? "closed_body" : "unavailable_body")}</p>
        <div className="flex flex-wrap gap-4">
          <Link href={user ? isCoach(user) ? "/settings" : "/dashboard" : "/login"} className="inline-flex min-h-11 items-center font-bold text-[var(--color-main)] underline">
            {t(user && !isCoach(user) ? "home" : "account")}
          </Link>
          {!availability && <button type="button" onClick={() => window.location.reload()} className="min-h-11 font-bold underline">{t("retry")}</button>}
        </div>
      </div>
    </main>
  );
}
