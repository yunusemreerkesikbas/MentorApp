import type { Metadata } from "next";
import type { ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { pickMessages } from "@/i18n/scoped-messages";
import { AuthShell } from "./_components/auth-shell";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AuthLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const messages = pickMessages(await getMessages(), ["auth", "common"]);
  return (
    <NextIntlClientProvider messages={messages}>
      <AuthShell>{children}</AuthShell>
    </NextIntlClientProvider>
  );
}
