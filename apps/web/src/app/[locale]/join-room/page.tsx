import type { Metadata } from "next";
import { Suspense } from "react";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { pickMessages } from "@/i18n/scoped-messages";
import { RoomJoinShell } from "./_components/room-join-shell";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * `/masaya-katil?kod=…` — the landing page for a shared invite link.
 *
 * Deliberately outside the `(app)` group: that layout bounces anonymous visitors straight to
 * login, and the whole point of an invite link is that it works for someone who has never
 * opened the app. This page owns the signed-out detour itself.
 */
export default async function JoinRoomPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const messages = pickMessages(await getMessages(), ["session_room"]);
  return (
    <NextIntlClientProvider messages={messages}>
      <Suspense>
        <RoomJoinShell />
      </Suspense>
    </NextIntlClientProvider>
  );
}
