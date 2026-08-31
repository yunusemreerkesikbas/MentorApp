"use client";

import { useEffect, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { AppNav } from "@/components/app-nav";
import { usePathname, useRouter } from "@/i18n/navigation";
import { hidesMobileAppChrome } from "@/lib/app-sidebar";
import { MOBILE_TAB_BAR_PADDING_CLASS } from "@/lib/app-shell";
import { useAuth } from "@/lib/auth-context";
import { CoinCelebrationProvider } from "@/lib/coin-celebration-context";
import { NotificationDrawerShell } from "@/lib/notification-drawer-shell";
import { hasCompletedOnboarding } from "@/lib/post-auth-destination";
import { PremiumPaywallProvider } from "@/lib/premium-paywall";

/** Auth guard and responsive app chrome; the server layout owns metadata and messages. */
export function AppShell({ children }: { children: ReactNode }) {
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
        <CoinCelebrationProvider>
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
        </CoinCelebrationProvider>
      </PremiumPaywallProvider>
    </NotificationDrawerShell>
  );
}
