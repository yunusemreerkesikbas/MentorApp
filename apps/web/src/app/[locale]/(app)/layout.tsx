"use client";

import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { useEffect, type ReactNode } from "react";
import { AppNav } from "@/components/app-nav";
import { MOBILE_TAB_BAR_PADDING_CLASS } from "@/lib/app-shell";
import { useAuth } from "@/lib/auth-context";
import { NotificationDrawerShell } from "@/lib/notification-drawer-shell";
import { hasCompletedOnboarding } from "@/lib/post-auth-destination";

/**
 * App shell + auth guard: anonymous users are redirected to /login.
 * Layout (DESIGN.md §8): bottom tab bar on mobile, left sidebar ≥1024px.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  const { status, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("panel");
  const isCommunityWorkspace =
    pathname === "/community" || pathname.startsWith("/community/");

  useEffect(() => {
    if (status === "anonymous") router.replace("/login");
    if (status === "authenticated" && user && !hasCompletedOnboarding(user)) {
      router.replace("/onboarding");
    }
  }, [status, user, router]);

  if (status !== "authenticated" || !user || !hasCompletedOnboarding(user)) {
    return (
      <main
        className="flex min-h-screen items-center justify-center px-5"
        style={{ backgroundColor: "var(--color-bg)" }}
      >
        <p style={{ color: "var(--color-secondary)" }}>{t("loading")}</p>
      </main>
    );
  }

  return (
    <NotificationDrawerShell>
      <div
        className="min-h-screen"
        style={{ backgroundColor: "var(--color-bg)" }}
      >
        {isCommunityWorkspace ? null : <AppNav />}
        <div
          className={
            isCommunityWorkspace
              ? "min-h-screen"
              : `min-h-screen ${MOBILE_TAB_BAR_PADDING_CLASS} lg:pb-0 lg:pl-60`
          }
        >
          {children}
        </div>
      </div>
    </NotificationDrawerShell>
  );
}
