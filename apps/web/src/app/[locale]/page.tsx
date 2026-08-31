import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { pickMessages } from "@/i18n/scoped-messages";
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
  const messages = pickMessages(await getMessages(), ["welcome"]);
  return (
    <NextIntlClientProvider messages={messages}>
      <WelcomeShell />
    </NextIntlClientProvider>
  );
}
