import { setRequestLocale } from "@/i18n/locale";
import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { pickMessages, ROUTE_MESSAGE_SCOPES } from "@/i18n/scoped-messages";
import { WelcomeShell } from "./_components/welcome/welcome-shell";

export const metadata: Metadata = {
  robots: { index: false, follow: true },
};

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const messages = pickMessages(await getMessages(), ROUTE_MESSAGE_SCOPES.welcome);
  return (
    <NextIntlClientProvider messages={messages}>
      <WelcomeShell />
    </NextIntlClientProvider>
  );
}
