"use client";

import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { useEffect, type ReactNode } from "react";
import { AppNav } from "@/components/app-nav";
import { hidesMobileAppChrome } from "@/lib/app-sidebar";
import { MOBILE_TAB_BAR_PADDING_CLASS } from "@/lib/app-shell";
import { useAuth } from "@/lib/auth-context";
import { NotificationDrawerShell } from "@/lib/notification-drawer-shell";
import { PremiumPaywallProvider } from "@/lib/premium-paywall";
import { hasCompletedOnboarding } from "@/lib/post-auth-destination";

/**
 * App shell + auth guard: anonymous users are redirected to /login.
 * Layout (DESIGN.md §8): bottom tab bar on mobile, left sidebar ≥1024px.
 * Community keeps its own mobile chrome; desktop AppNav stays in place and
 * starts collapsed like `/hedef/pano`. The board editor also keeps the
 * desktop sidebar collapsed so the collage stays full-preview without losing nav.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  const { status, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("panel");
  const hideMobileTabOffset = hidesMobileAppChrome(pathname);

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
      <PremiumPaywallProvider>
        <div
          className="min-h-screen"
          style={{ backgroundColor: "var(--color-bg)" }}
        >
          <AppNav />
          <div
            className={
              hideMobileTabOffset
                ? "mentor-app-shell min-h-screen"
                : `mentor-app-shell min-h-screen ${MOBILE_TAB_BAR_PADDING_CLASS} lg:pb-0`
            }
          >
            {children}
          </div>
        </div>
      </PremiumPaywallProvider>
    </NotificationDrawerShell>
  );
}
