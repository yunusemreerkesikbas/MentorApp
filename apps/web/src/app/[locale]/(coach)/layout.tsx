import { setRequestLocale } from "@/i18n/locale";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { pickMessages, ROUTE_MESSAGE_SCOPES } from "@/i18n/scoped-messages";
import { CoachShell } from "./coach-shell";

/**
 * The HUMAN coach surface (W8). Deliberately its own route group, not part of `(app)`:
 *
 *  - the student panel is a daily ritual (streak, mood, ghost); this is a work tool (roster,
 *    report, assignments). Sharing one shell would put two mental models in one chrome.
 *  - it carries only the `mentorship` messages, so the student bundle does not grow.
 *
 * Nothing in here may import from `(app)/**`. The roadmap (§9) puts this surface in its own
 * `apps/panel` app once the coach cohort justifies one; keeping the dependency arrow one-way
 * is what makes that move a file copy instead of an untangling.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function CoachLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const messages = pickMessages(await getMessages(), ROUTE_MESSAGE_SCOPES.coaching);
  return (
    <NextIntlClientProvider messages={messages}>
      <CoachShell>{children}</CoachShell>
    </NextIntlClientProvider>
  );
}
