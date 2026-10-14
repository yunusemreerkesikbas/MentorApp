"use client";

import { use, useEffect } from "react";
import { NextIntlClientProvider, useLocale, type AbstractIntlMessages } from "next-intl";
import { AppNav } from "@/components/app-nav";
import { refreshEconomySnapshot } from "@/lib/economy-store";
import { NotificationDrawerShell } from "@/lib/notification-drawer-shell";
import { SubscriptionProvider } from "@/lib/subscription-context";

/**
 * The app's own navigation for a member on the public blog: the sidebar, phone tab bar, bell and
 * coach FAB of `(app)`, mounted beside the page and never around it, so a post's client islands
 * (view tracking, the ad slot) do not remount when the session resolves.
 *
 * No `EconomySync`: it would consume unseen rewards here, where nothing celebrates them. The pills
 * only need the balance, which the app's sync resets when it unmounts.
 */
export function BlogMemberChrome({ catalog }: { catalog: Promise<AbstractIntlMessages> }) {
  const locale = useLocale();
  const messages = use(catalog);

  useEffect(() => {
    void refreshEconomySnapshot();
  }, []);

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <SubscriptionProvider>
        <NotificationDrawerShell>
          <AppNav />
        </NotificationDrawerShell>
      </SubscriptionProvider>
    </NextIntlClientProvider>
  );
}
