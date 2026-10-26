import { setRequestLocale } from "@/i18n/locale";
import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { pickMessages, ROUTE_MESSAGE_SCOPES } from "@/i18n/scoped-messages";
import { InviteLandingShell } from "./_components/invite-landing-shell";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * `/davet/PUHU-XXXXXXXX` — the landing page for a friend's invite link.
 *
 * Deliberately outside the `(app)` group, like `/masaya-katil`: that layout bounces anonymous
 * visitors straight to login, and the whole point of this link is that it works for someone who
 * has never opened the app. This page owns the signed-out detour itself.
 */
export default async function InviteLandingPage({
  params,
}: {
  params: Promise<{ locale: string; code: string }>;
}) {
  const { locale, code } = await params;
  setRequestLocale(locale);
  const messages = pickMessages(await getMessages(), ROUTE_MESSAGE_SCOPES.inviteLanding);
  return (
    <NextIntlClientProvider messages={messages}>
      <InviteLandingShell code={code} />
    </NextIntlClientProvider>
  );
}
