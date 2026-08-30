"use client";

import type { ReactNode } from "react";
import { AppNav } from "@/components/app-nav";
import { PublicChrome } from "@/components/public-chrome";
import { useAuth } from "@/lib/auth-context";
import { MOBILE_TAB_BAR_PADDING_CLASS } from "@/lib/app-shell";
import { NotificationDrawerShell } from "@/lib/notification-drawer-shell";
import { PremiumPaywallProvider } from "@/lib/premium-paywall";

/**
 * Article chrome: logged-in readers get the app sidebar (so the public header is redundant).
 * Anonymous SEO visitors keep the logo + login bar and legal footer.
 */
export function ArticleChrome({
  children,
  footer,
  loginLabel,
}: {
  children: ReactNode;
  footer: ReactNode;
  loginLabel: string;
}) {
  const { status } = useAuth();

  if (status === "authenticated") {
    return (
      <NotificationDrawerShell>
        <PremiumPaywallProvider>
          <div className="min-h-screen" style={{ backgroundColor: "var(--color-bg)" }}>
            <AppNav />
            <div
              className={`mentor-app-shell min-h-screen ${MOBILE_TAB_BAR_PADDING_CLASS} lg:pb-0`}
            >
              {children}
            </div>
          </div>
        </PremiumPaywallProvider>
      </NotificationDrawerShell>
    );
  }

  if (status === "anonymous") {
    return (
      <PublicChrome loginLabel={loginLabel} panelLabel={loginLabel}>
        {children}
        {footer}
      </PublicChrome>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--color-bg)" }}>
      {children}
    </div>
  );
}
