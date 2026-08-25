import { setRequestLocale } from "next-intl/server";
import { RoomShell } from "../../_components/room-shell";

/** `/seans/masa/[id]` — the shared table: seats, live presence, and the invite code. */
export default async function StudyRoomPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  return <RoomShell roomId={id} />;
}
