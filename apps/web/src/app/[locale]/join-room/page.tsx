import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { RoomJoinShell } from "./_components/room-join-shell";

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
  return (
    <Suspense>
      <RoomJoinShell />
    </Suspense>
  );
}
