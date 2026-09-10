"use client";

import { useEffect, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { AppNav } from "@/components/app-nav";
import { usePathname, useRouter } from "@/i18n/navigation";
import { hidesMobileAppChrome } from "@/lib/app-sidebar";
import { MOBILE_TAB_BAR_PADDING_CLASS } from "@/lib/app-shell";
import { useAuth } from "@/lib/auth-context";
import { COACH_HOME, isCoach, isStudentOnlyPath } from "@/lib/coach-surface";
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

  /**
   * A coach on a student-only screen (APP-090).
   *
   * Not every `(app)` route: settings, profile, subscription, community and knowledge stay open,
   * because a coach locked out of `/abonelik` could not buy Koç Pro and one locked out of
   * `/ayarlar` could not change their password. `isStudentOnlyPath` carries the block list and the
   * reasoning behind its direction.
   */
  const bouncedToCoachHome = isCoach(user) && isStudentOnlyPath(pathname);

  useEffect(() => {
    if (status === "anonymous") router.replace("/login");
    if (status === "authenticated" && user && !hasCompletedOnboarding(user)) {
      router.replace("/onboarding");
    }
    if (status === "authenticated" && bouncedToCoachHome) router.replace(COACH_HOME);
  }, [status, user, router, bouncedToCoachHome]);

  // `/plan` owns a role-aware loading skeleton. Let that route render while the silent refresh
  // resolves; every other app route keeps the shared guard fallback below.
  if (status === "loading" && pathname === "/plan") {
    return (
      <div className="min-h-screen" style={{ backgroundColor: "var(--color-bg)" }}>
        {children}
      </div>
    );
  }

  // `bouncedToCoachHome` is in the render gate as well as the effect: without it the student panel
  // paints for one frame before the replace lands, which is the exact screen this ticket exists to
  // stop a coach from seeing.
  if (status !== "authenticated" || !user || !hasCompletedOnboarding(user) || bouncedToCoachHome) {
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
